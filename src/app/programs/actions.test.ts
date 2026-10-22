import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/userDate", () => ({ getToday: async () => "2026-09-25" }));

const getUser = vi.fn();
const rpc = vi.fn();
let libraryResult: { data: unknown; error: unknown } = { data: [], error: null };
const libraryQuery = {
  is: () => libraryQuery,
  in: () => libraryQuery,
  eq: () => libraryQuery,
  then: (resolve: (v: unknown) => unknown) => Promise.resolve(libraryResult).then(resolve),
};
// workout_plans: the days that already have a plan (none by default).
let plansResult: { data: unknown; error: unknown } = { data: [], error: null };
const plansQuery = {
  eq: () => plansQuery,
  in: () => plansQuery,
  then: (resolve: (v: unknown) => unknown) => Promise.resolve(plansResult).then(resolve),
};
const deleted: unknown[][] = [];
const from = vi.fn((table: string) => ({
  select: () => (table === "workout_plans" ? plansQuery : libraryQuery),
  delete: () => {
    const builder = { eq: () => builder, in: (_column: string, ids: unknown[]) => (deleted.push(ids), Promise.resolve({ error: null })) };
    return builder;
  },
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));

const { applyProgram, undoProgram } = await import("./actions");
const { findProgram } = await import("@/lib/programs");

const fullBody = findProgram("full-body-ab")!;
const allNames = [...new Set(fullBody.days.flatMap((d) => d.exercises.map((e) => e.name)))];
const library = allNames.map((name, i) => ({
  id: `ex-${i}`,
  name,
  exercise_muscle_groups: [{ muscle_group_id: `mg-${i % 2}` }],
}));

const valid = { programId: "full-body-ab", startDate: "2026-09-28", weekdays: [1, 3, 5], weeks: 2 };

describe("applyProgram", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    rpc.mockReset();
    libraryResult = { data: library, error: null };
    plansResult = { data: [], error: null };
    deleted.length = 0;
  });

  it("schedules every day in one RPC call with ids, targets and muscle groups", async () => {
    rpc.mockResolvedValue({ data: 6, error: null });
    const result = await applyProgram(valid);
    expect(result).toMatchObject({ success: true, created: 6, skipped: 0, firstDate: "2026-09-28" });
    expect("success" in result && result.createdDates).toHaveLength(6);
    expect(rpc).toHaveBeenCalledTimes(1);
    const plans = rpc.mock.calls[0][1].p_plans;
    expect(plans).toHaveLength(6);
    expect(plans[0]).toMatchObject({ date: "2026-09-28", title: "Full Body A/B · Full Body A" });
    expect(plans[1].title).toBe("Full Body A/B · Full Body B");
    expect(plans[0].exercises[0]).toEqual({
      exercise_id: library.find((l) => l.name === "Back Squat")!.id,
      position: 0,
      target_sets: 3,
      target_reps: 5,
    });
    expect(plans[0].muscle_group_ids.sort()).toEqual(["mg-0", "mg-1"]);
  });

  it("reports days skipped because they already had a plan", async () => {
    rpc.mockResolvedValue({ data: 4, error: null });
    expect(await applyProgram(valid)).toMatchObject({ created: 4, skipped: 2 });
  });

  it.each([
    ["an unknown program", { programId: "nope" }],
    ["a malformed date", { startDate: "28/09/2026" }],
    ["an impossible date", { startDate: "2026-02-31" }],
    ["a past start date", { startDate: "2026-09-24" }],
    ["too many weeks", { weeks: 17 }],
    ["zero weeks", { weeks: 0 }],
    ["no training days", { weekdays: [] }],
    ["only invalid training days", { weekdays: [7, -1] }],
  ])("rejects %s without writing", async (_label, override) => {
    const result = await applyProgram({ ...valid, ...override });
    expect(result).toHaveProperty("error");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("names exercises missing from the library and writes nothing", async () => {
    libraryResult = { data: library.filter((l) => l.name !== "Hip Thrust"), error: null };
    const result = await applyProgram(valid);
    expect(result).toEqual({ error: expect.stringContaining("Hip Thrust") });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("returns a safe error when the RPC fails", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await applyProgram(valid)).toEqual({ error: expect.stringContaining("Nothing was changed") });
  });

  it("requires sign-in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await applyProgram(valid)).toEqual({ error: "Not signed in" });
  });
});

describe("undoProgram", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    deleted.length = 0;
  });

  it("removes only the plans the program created, recognised by its titles", async () => {
    plansResult = {
      data: [
        { id: "p-1", title: `${fullBody.name} · Day A` },
        { id: "p-2", title: "My own leg day" },
      ],
      error: null,
    };
    expect(await undoProgram("full-body-ab", ["2026-09-28", "2026-09-30"])).toEqual({ removed: 1 });
    expect(deleted).toEqual([["p-1"]]);
  });

  it("rejects bad input without touching anything", async () => {
    expect(await undoProgram("nope", ["2026-09-28"])).toHaveProperty("error");
    expect(await undoProgram("full-body-ab", [])).toHaveProperty("error");
    expect(await undoProgram("full-body-ab", ["not-a-date"])).toHaveProperty("error");
    expect(deleted).toHaveLength(0);
  });
});
