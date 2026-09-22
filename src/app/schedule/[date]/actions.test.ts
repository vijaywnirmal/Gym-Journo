import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const rpc = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
  }),
}));

const { savePlan } = await import("./actions");

const baseInput = {
  date: "2026-09-22",
  title: "Push Day",
  isRestDay: false,
  muscleGroupIds: ["mg-1"],
  exercises: [{ exerciseId: "ex-1", targetSets: 3, targetReps: 8 }],
};

describe("savePlan", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { id: "plan-1" }, error: null });
  });

  it("requires the user to be signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await savePlan(baseInput);
    expect(result).toEqual({ error: "Not signed in" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("persists the plan via a single atomic RPC call, defaulting a blank title to null", async () => {
    const result = await savePlan({ ...baseInput, title: "" });
    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_workout_plan", {
      p_date: "2026-09-22",
      p_title: null,
      p_is_rest_day: false,
      p_muscle_group_ids: ["mg-1"],
      p_exercises: [
        {
          exercise_id: "ex-1",
          position: 0,
          target_sets: 3,
          target_reps: 8,
          target_weight: null,
          target_weight_unit: "kg",
        },
      ],
    });
  });

  it("sends a supplied target weight and unit", async () => {
    await savePlan({
      ...baseInput,
      exercises: [{ exerciseId: "ex-1", targetSets: 3, targetReps: 8, targetWeight: 82.5, targetWeightUnit: "lb" }],
    });
    expect(rpc).toHaveBeenCalledWith(
      "save_workout_plan",
      expect.objectContaining({
        p_exercises: [
          expect.objectContaining({ target_weight: 82.5, target_weight_unit: "lb" }),
        ],
      })
    );
  });

  it("accepts a target weight of exactly 0 — a bodyweight exercise's target is 'no added weight'", async () => {
    const result = await savePlan({
      ...baseInput,
      exercises: [{ exerciseId: "ex-1", targetSets: null, targetReps: null, targetWeight: 0 }],
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects an out-of-range or negative target weight before calling the RPC", async () => {
    for (const targetWeight of [-1, 501]) {
      const result = await savePlan({
        ...baseInput,
        exercises: [{ exerciseId: "ex-1", targetSets: null, targetReps: null, targetWeight }],
      });
      expect(result.error).toBeTruthy();
    }
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid weight unit before calling the RPC", async () => {
    const result = await savePlan({
      ...baseInput,
      exercises: [{ exerciseId: "ex-1", targetSets: null, targetReps: null, targetWeightUnit: "stone" }],
    });
    expect(result.error).toBe("Invalid weight unit.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("a rest day sends no muscle groups or exercises, regardless of what's still selected client-side", async () => {
    const result = await savePlan({ ...baseInput, isRestDay: true });
    expect(result).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith(
      "save_workout_plan",
      expect.objectContaining({ p_is_rest_day: true, p_muscle_group_ids: [], p_exercises: [] })
    );
  });

  it("shows a generic error and never the database's own message — the RPC call is a single transaction: nothing is left half-written", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "duplicate key value violates unique constraint" } });
    const result = await savePlan(baseInput);
    expect(result).toEqual({ error: "Couldn't save your schedule. Please try again." });
  });
});
