import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/userDate", () => ({ getToday: async () => "2026-09-25" }));

const getUser = vi.fn();
const rpc = vi.fn();
let libraryResult: { data: unknown; error: unknown } = { data: [], error: null };
const libraryQuery = {
  is: () => libraryQuery,
  in: () => libraryQuery,
  then: (resolve: (v: unknown) => unknown) => Promise.resolve(libraryResult).then(resolve),
};
const from = vi.fn(() => ({ select: () => libraryQuery }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser }, from, rpc }),
}));

const { applyProgram } = await import("./actions");
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
  });

  it("schedules every day in one RPC call with ids, targets and muscle groups", async () => {
    rpc.mockResolvedValue({ data: 6, error: null });
    const result = await applyProgram(valid);
    expect(result).toEqual({ success: true, created: 6, skipped: 0, firstDate: "2026-09-28" });
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
