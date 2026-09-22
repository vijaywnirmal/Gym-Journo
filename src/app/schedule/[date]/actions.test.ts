import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

const plansSingle = vi.fn();
const plansSelect = vi.fn().mockReturnValue({ single: plansSingle });
const plansUpsert = vi.fn().mockReturnValue({ select: plansSelect });

const muscleGroupsDeleteResult = vi.fn().mockResolvedValue({ error: null });
const muscleGroupsDeleteEq = vi.fn().mockImplementation(() => muscleGroupsDeleteResult());
const muscleGroupsDelete = vi.fn().mockReturnValue({ eq: muscleGroupsDeleteEq });
const muscleGroupsInsert = vi.fn().mockResolvedValue({ error: null });

const plannedExercisesDeleteResult = vi.fn().mockResolvedValue({ error: null });
const plannedExercisesDeleteEq = vi.fn().mockImplementation(() => plannedExercisesDeleteResult());
const plannedExercisesDelete = vi.fn().mockReturnValue({ eq: plannedExercisesDeleteEq });
const plannedExercisesInsert = vi.fn().mockResolvedValue({ error: null });

const from = vi.fn((table: string) => {
  if (table === "workout_plans") return { upsert: plansUpsert };
  if (table === "workout_plan_muscle_groups") return { delete: muscleGroupsDelete, insert: muscleGroupsInsert };
  if (table === "planned_exercises") return { delete: plannedExercisesDelete, insert: plannedExercisesInsert };
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    from,
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
    plansSingle.mockReset();
    plansSingle.mockResolvedValue({ data: { id: "plan-1" }, error: null });
    plansUpsert.mockClear();
    muscleGroupsDelete.mockClear();
    muscleGroupsDeleteEq.mockClear();
    muscleGroupsInsert.mockClear();
    plannedExercisesDelete.mockClear();
    plannedExercisesDeleteEq.mockClear();
    plannedExercisesInsert.mockClear();
  });

  it("requires the user to be signed in", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const result = await savePlan(baseInput);
    expect(result).toEqual({ error: "Not signed in" });
    expect(plansUpsert).not.toHaveBeenCalled();
  });

  it("upserts the plan on (user_id, date) and defaults a blank title to null", async () => {
    const result = await savePlan({ ...baseInput, title: "" });
    expect(result).toEqual({ success: true });
    expect(plansUpsert).toHaveBeenCalledWith(
      { user_id: "user-1", date: "2026-09-22", title: null, is_rest_day: false },
      { onConflict: "user_id,date" }
    );
  });

  it("writes a planned exercise with no target weight as null, defaulting the unit to kg", async () => {
    await savePlan(baseInput);
    expect(plannedExercisesInsert).toHaveBeenCalledWith([
      {
        plan_id: "plan-1",
        exercise_id: "ex-1",
        position: 0,
        target_sets: 3,
        target_reps: 8,
        target_weight: null,
        target_weight_unit: "kg",
      },
    ]);
  });

  it("writes a supplied target weight and unit", async () => {
    await savePlan({
      ...baseInput,
      exercises: [{ exerciseId: "ex-1", targetSets: 3, targetReps: 8, targetWeight: 82.5, targetWeightUnit: "lb" }],
    });
    expect(plannedExercisesInsert).toHaveBeenCalledWith([
      {
        plan_id: "plan-1",
        exercise_id: "ex-1",
        position: 0,
        target_sets: 3,
        target_reps: 8,
        target_weight: 82.5,
        target_weight_unit: "lb",
      },
    ]);
  });

  it("accepts a target weight of exactly 0 — a bodyweight exercise's target is 'no added weight'", async () => {
    const result = await savePlan({
      ...baseInput,
      exercises: [{ exerciseId: "ex-1", targetSets: null, targetReps: null, targetWeight: 0 }],
    });
    expect(result).toEqual({ success: true });
  });

  it("rejects an out-of-range or negative target weight before writing anything", async () => {
    for (const targetWeight of [-1, 501]) {
      const result = await savePlan({
        ...baseInput,
        exercises: [{ exerciseId: "ex-1", targetSets: null, targetReps: null, targetWeight }],
      });
      expect(result.error).toBeTruthy();
      expect(plansUpsert).not.toHaveBeenCalled();
    }
  });

  it("rejects an invalid weight unit before writing anything", async () => {
    const result = await savePlan({
      ...baseInput,
      exercises: [{ exerciseId: "ex-1", targetSets: null, targetReps: null, targetWeightUnit: "stone" }],
    });
    expect(result.error).toBe("Invalid weight unit.");
    expect(plansUpsert).not.toHaveBeenCalled();
  });

  it("a rest day clears muscle groups and exercises, regardless of what's still selected client-side", async () => {
    const result = await savePlan({ ...baseInput, isRestDay: true });
    expect(result).toEqual({ success: true });
    expect(muscleGroupsInsert).not.toHaveBeenCalled();
    expect(plannedExercisesInsert).not.toHaveBeenCalled();
    // The clearing deletes still ran, so a day switched from workout to rest loses its old exercises.
    expect(muscleGroupsDeleteEq).toHaveBeenCalledWith("plan_id", "plan-1");
    expect(plannedExercisesDeleteEq).toHaveBeenCalledWith("plan_id", "plan-1");
  });

  it("reports the upsert's own error rather than a generic one", async () => {
    plansSingle.mockResolvedValue({ data: null, error: { message: "duplicate key" } });
    const result = await savePlan(baseInput);
    expect(result).toEqual({ error: "duplicate key" });
    expect(muscleGroupsDelete).not.toHaveBeenCalled();
  });
});
