import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
  }),
}));

const getPreviousPerformance = vi.fn();
vi.mock("@/lib/queries", () => ({
  getPreviousPerformance: (...args: unknown[]) => getPreviousPerformance(...args),
}));

const { saveLog, fetchPreviousPerformance } = await import("./actions");

const basicInput = {
  date: "2026-01-05",
  planId: null as string | null,
  notes: "",
  completed: false,
  exercises: [
    {
      exerciseId: "ex-1",
      sets: [{ reps: 10, weight: 60, weightUnit: "kg" }],
    },
  ],
};

describe("saveLog", () => {
  beforeEach(() => {
    rpc.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("requires the user to be signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await saveLog(basicInput);
    expect(result).toEqual({ error: "Not signed in" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("persists a planned workout via a single atomic RPC call", async () => {
    rpc.mockResolvedValue({ data: { id: "log-1" }, error: null });
    const result = await saveLog({ ...basicInput, planId: "plan-1" });
    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_workout_log", {
      p_date: "2026-01-05",
      p_plan_id: "plan-1",
      p_notes: null,
      p_completed: false,
      p_exercises: [
        {
          exercise_id: "ex-1",
          position: 0,
          sets: [{ set_number: 1, reps: 10, weight: 60, weight_unit: "kg" }],
        },
      ],
    });
  });

  it("persists a freeform workout with a null plan id", async () => {
    rpc.mockResolvedValue({ data: { id: "log-1" }, error: null });
    const result = await saveLog(basicInput);
    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith(
      "save_workout_log",
      expect.objectContaining({ p_plan_id: null })
    );
  });

  it("marks a workout completed", async () => {
    rpc.mockResolvedValue({ data: { id: "log-1" }, error: null });
    await saveLog({ ...basicInput, completed: true });
    expect(rpc).toHaveBeenCalledWith(
      "save_workout_log",
      expect.objectContaining({ p_completed: true })
    );
  });

  it("re-sends the full current exercise/set list on every save (overwrite semantics), not a diff", async () => {
    rpc.mockResolvedValue({ data: { id: "log-1" }, error: null });
    await saveLog({
      ...basicInput,
      exercises: [
        { exerciseId: "ex-1", sets: [{ reps: 8, weight: 65, weightUnit: "kg" }] },
        { exerciseId: "ex-2", sets: [] },
      ],
    });
    expect(rpc).toHaveBeenCalledWith(
      "save_workout_log",
      expect.objectContaining({
        p_exercises: [
          { exercise_id: "ex-1", position: 0, sets: [{ set_number: 1, reps: 8, weight: 65, weight_unit: "kg" }] },
          { exercise_id: "ex-2", position: 1, sets: [] },
        ],
      })
    );
  });

  it("does not call any separate delete/insert path — persistence is a single RPC call", async () => {
    rpc.mockResolvedValue({ data: { id: "log-1" }, error: null });
    await saveLog(basicInput);
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("returns a safe generic error when the RPC fails, without leaking DB internals", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "duplicate key value violates unique constraint" } });
    const result = await saveLog(basicInput);
    expect(result.error).toBe("Couldn't save your workout. Please try again.");
    expect(result.error).not.toContain("duplicate key");
  });

  it("can be retried after a failure and succeed", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "network error" } });
    const first = await saveLog(basicInput);
    expect(first.error).toBeTruthy();

    rpc.mockResolvedValueOnce({ data: { id: "log-1" }, error: null });
    const second = await saveLog(basicInput);
    expect(second).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("rejects negative reps without calling the database", async () => {
    const result = await saveLog({
      ...basicInput,
      exercises: [{ exerciseId: "ex-1", sets: [{ reps: -1, weight: 60, weightUnit: "kg" }] }],
    });
    expect(result.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects negative weight without calling the database", async () => {
    const result = await saveLog({
      ...basicInput,
      exercises: [{ exerciseId: "ex-1", sets: [{ reps: 10, weight: -5, weightUnit: "kg" }] }],
    });
    expect(result.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a non-integer reps value", async () => {
    const result = await saveLog({
      ...basicInput,
      exercises: [{ exerciseId: "ex-1", sets: [{ reps: 10.5, weight: 60, weightUnit: "kg" }] }],
    });
    expect(result.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid weight unit", async () => {
    const result = await saveLog({
      ...basicInput,
      exercises: [{ exerciseId: "ex-1", sets: [{ reps: 10, weight: 60, weightUnit: "stone" }] }],
    });
    expect(result.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a malformed/missing exercise id", async () => {
    const result = await saveLog({
      ...basicInput,
      exercises: [{ exerciseId: "", sets: [] }],
    });
    expect(result.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts null reps/weight (an intentionally empty set row)", async () => {
    rpc.mockResolvedValue({ data: { id: "log-1" }, error: null });
    const result = await saveLog({
      ...basicInput,
      exercises: [{ exerciseId: "ex-1", sets: [{ reps: null, weight: null, weightUnit: "kg" }] }],
    });
    expect(result).toEqual({ success: true });
  });
});

describe("fetchPreviousPerformance", () => {
  beforeEach(() => {
    getPreviousPerformance.mockReset();
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  });

  it("returns null when signed out, without querying", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await fetchPreviousPerformance("ex-1", "2026-01-05");
    expect(result).toBeNull();
    expect(getPreviousPerformance).not.toHaveBeenCalled();
  });

  it("delegates to getPreviousPerformance for a signed-in user", async () => {
    getPreviousPerformance.mockResolvedValue({ date: "2026-01-01", sets: [] });
    const result = await fetchPreviousPerformance("ex-1", "2026-01-05");
    expect(getPreviousPerformance).toHaveBeenCalledWith("ex-1", "2026-01-05");
    expect(result).toEqual({ date: "2026-01-01", sets: [] });
  });
});
