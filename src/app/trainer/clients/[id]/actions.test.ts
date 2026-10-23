import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// after() runs its callback once the response is sent; here, when the test says so.
const afterCallbacks: (() => Promise<void>)[] = [];
vi.mock("next/server", () => ({ after: (fn: () => Promise<void>) => afterCallbacks.push(fn) }));
const runAfter = async () => {
  for (const fn of afterCallbacks.splice(0)) await fn();
};
const notifyUser = vi.fn();
vi.mock("@/lib/push/notifyUser", () => ({ notifyUser: (...args: unknown[]) => notifyUser(...args) }));

const rpc = vi.fn();
const libraryQuery = {
  select: () => libraryQuery,
  is: () => libraryQuery,
  in: (_column: string, names: string[]) =>
    Promise.resolve({
      data: names.map((name, i) => ({ id: `ex-${i}`, name, exercise_muscle_groups: [{ muscle_group_id: "mg-1" }] })),
      error: null,
    }),
};
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc, from: () => libraryQuery }) }));

const getClient = vi.fn();
const getClientPlans = vi.fn();
vi.mock("@/lib/trainers", () => ({
  getClient: (id: string) => getClient(id),
  getClientPlans: (...args: unknown[]) => getClientPlans(...args),
  getMyTrainerProfile: async () => ({ display_name: "Ravi" }),
}));

const { saveClientPlan, deleteClientPlan, applyClientProgram, undoClientProgram, endCoaching } = await import("./actions");

const planInput = {
  date: "2026-10-23",
  title: "Legs",
  dayType: "workout" as const,
  muscleGroupIds: ["mg-1"],
  exercises: [{ exerciseId: "ex-1", targetSets: 3, targetReps: 8, targetWeight: 60, targetWeightUnit: "kg" }],
};

describe("saveClientPlan", () => {
  beforeEach(() => rpc.mockReset());

  it("saves through save_client_plan for that client", async () => {
    rpc.mockResolvedValue({ data: { id: "p1" }, error: null });
    expect(await saveClientPlan("c1", planInput)).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("save_client_plan", {
      p_client_id: "c1",
      p_date: "2026-10-23",
      p_title: "Legs",
      p_off_kind: null,
      p_muscle_group_ids: ["mg-1"],
      p_exercises: [{ exercise_id: "ex-1", position: 0, target_sets: 3, target_reps: 8, target_weight: 60, target_weight_unit: "kg" }],
    });
  });

  it("sends no exercises for a day off, and checks targets first", async () => {
    rpc.mockResolvedValue({ data: { id: "p1" }, error: null });
    await saveClientPlan("c1", { ...planInput, dayType: "rest" });
    expect(rpc).toHaveBeenLastCalledWith("save_client_plan", expect.objectContaining({ p_off_kind: "rest", p_exercises: [], p_muscle_group_ids: [] }));
    rpc.mockClear();
    expect((await saveClientPlan("c1", { ...planInput, exercises: [{ exerciseId: "ex-1", targetSets: 0, targetReps: 8 }] })).error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("tells the client about plans from their today onwards, after responding", async () => {
    notifyUser.mockClear();
    afterCallbacks.length = 0;
    getClient.mockResolvedValue({ client_today: "2026-10-23" });
    rpc.mockResolvedValue({ data: { id: "p1" }, error: null });

    await saveClientPlan("c1", planInput);
    expect(notifyUser).not.toHaveBeenCalled();
    await runAfter();
    expect(notifyUser).toHaveBeenCalledWith("c1", {
      title: "Ravi planned your workout",
      body: "Today: Legs",
      url: "/",
      tag: "trainer-plan",
    });

    notifyUser.mockClear();
    await saveClientPlan("c1", { ...planInput, date: "2026-10-22" });
    await runAfter();
    expect(notifyUser).not.toHaveBeenCalled();

    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not this person's trainer" } });
    await saveClientPlan("c1", planInput);
    await runAfter();
    expect(notifyUser).not.toHaveBeenCalled();
  });

  it("explains the database's refusals", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501", message: "Not this person's trainer" } });
    expect((await saveClientPlan("c1", planInput)).error).toBe("You're no longer this person's trainer.");
    rpc.mockResolvedValue({ data: null, error: { code: "P0001", message: "Unknown exercise" } });
    expect((await saveClientPlan("c1", planInput)).error).toMatch(/custom one your client can't see/);
    rpc.mockResolvedValue({ data: null, error: { code: "08000", message: "connection reset" } });
    expect((await saveClientPlan("c1", planInput)).error).toBe("Couldn't save the plan. Please try again.");
  });
});

describe("deleteClientPlan", () => {
  beforeEach(() => rpc.mockReset());

  it("removes the client's plan for that date", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await deleteClientPlan("c1", "p1", "2026-10-23")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("delete_client_plan", { p_client_id: "c1", p_date: "2026-10-23" });
    rpc.mockResolvedValue({ data: false, error: null });
    expect((await deleteClientPlan("c1", "p1", "2026-10-23")).error).toBe("This plan was already removed.");
  });
});

describe("applyClientProgram", () => {
  beforeEach(() => {
    rpc.mockReset();
    getClient.mockReset();
    getClientPlans.mockReset();
  });

  it("is refused once the link has ended", async () => {
    getClient.mockResolvedValue(null);
    expect(await applyClientProgram("c1", { programId: "full-body-ab", startDate: "2026-10-26", weekdays: [1, 3, 5], weeks: 4 })).toEqual({
      error: "You're no longer this person's trainer.",
    });
  });

  it("judges the start date by the client's today and reports what it created", async () => {
    getClient.mockResolvedValue({ client_today: "2026-10-23" });
    expect(
      (await applyClientProgram("c1", { programId: "full-body-ab", startDate: "2026-10-22", weekdays: [1], weeks: 4 })) as { error: string }
    ).toEqual({ error: "The start date can't be in the past." });

    getClientPlans.mockResolvedValue([{ date: "2026-10-26", title: "Mine" }]);
    rpc.mockResolvedValue({ data: 3, error: null });
    const result = await applyClientProgram("c1", { programId: "full-body-ab", startDate: "2026-10-26", weekdays: [1], weeks: 4 });
    expect(result).toMatchObject({ success: true, created: 3, skipped: 1, firstDate: "2026-10-26" });
    expect("createdDates" in result && result.createdDates).not.toContain("2026-10-26");
    expect(rpc).toHaveBeenCalledWith("apply_program_for_client", expect.objectContaining({ p_client_id: "c1" }));
  });
});

describe("undoClientProgram", () => {
  beforeEach(() => {
    rpc.mockReset();
    getClientPlans.mockReset();
  });

  it("removes only the days that still carry the program's title", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const { findProgram } = await import("@/lib/programs");
    const program = findProgram("full-body-ab")!;
    getClientPlans.mockResolvedValue([
      { date: "2026-10-26", title: `${program.name} · ${program.days[0].title}` },
      { date: "2026-10-28", title: "Renamed by the client" },
    ]);
    expect(await undoClientProgram("c1", "full-body-ab", ["2026-10-26", "2026-10-28"])).toEqual({ removed: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("delete_client_plan", { p_client_id: "c1", p_date: "2026-10-26" });
  });
});

describe("endCoaching", () => {
  it("ends the link", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    expect(await endCoaching("link-1")).toEqual({ success: true });
    expect(rpc).toHaveBeenCalledWith("end_trainer_link", { p_link_id: "link-1" });
  });
});
