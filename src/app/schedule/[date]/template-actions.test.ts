import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const rpc = vi.fn();

const templatesDeleteResult = vi.fn();
const templatesDeleteEq2 = vi.fn().mockImplementation(() => templatesDeleteResult());
const templatesDeleteEq1 = vi.fn().mockReturnValue({ eq: templatesDeleteEq2 });
const templatesDelete = vi.fn().mockReturnValue({ eq: templatesDeleteEq1 });

const from = vi.fn((table: string) => {
  if (table === "workout_templates") {
    return { delete: templatesDelete };
  }
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
    rpc,
    from,
  }),
}));

const getExercises = vi.fn();
vi.mock("@/lib/queries", () => ({
  getExercises: () => getExercises(),
}));

const { saveTemplate, deleteTemplate } = await import("./template-actions");

const visibleExercises = [
  { id: "sys-1", user_id: null, name: "Bench Press", equipment: "Barbell", notes: null },
  { id: "custom-1", user_id: "user-1", name: "My Curl", equipment: null, notes: null },
];

describe("saveTemplate", () => {
  beforeEach(() => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    getExercises.mockReset();
    getExercises.mockResolvedValue(visibleExercises);
    rpc.mockReset();
    rpc.mockResolvedValue({ data: { id: "template-1" }, error: null });
  });

  it("rejects an empty/whitespace name", async () => {
    const result = await saveTemplate({ name: "   ", exercises: [] });
    expect(result.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects a name over the maximum length", async () => {
    const result = await saveTemplate({ name: "a".repeat(101), exercises: [] });
    expect(result.error).toBeTruthy();
  });

  it("creates a new template via a single atomic RPC call with trimmed name and no exercises", async () => {
    const result = await saveTemplate({ name: "  Push A  ", exercises: [] });
    expect(result).toEqual({ success: true, templateId: "template-1" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc).toHaveBeenCalledWith("save_workout_template", {
      p_template_id: null,
      p_name: "Push A",
      p_exercises: [],
    });
  });

  it("sends template_exercises in position order with copied targets", async () => {
    const result = await saveTemplate({
      name: "Push A",
      exercises: [
        { exerciseId: "sys-1", targetSets: 3, targetReps: 8 },
        { exerciseId: "custom-1", targetSets: null, targetReps: null },
      ],
    });
    expect(result.success).toBe(true);
    expect(rpc).toHaveBeenCalledWith(
      "save_workout_template",
      expect.objectContaining({
        p_exercises: [
          {
            exercise_id: "sys-1",
            position: 0,
            target_sets: 3,
            target_reps: 8,
            target_weight: null,
            target_weight_unit: "kg",
          },
          {
            exercise_id: "custom-1",
            position: 1,
            target_sets: null,
            target_reps: null,
            target_weight: null,
            target_weight_unit: "kg",
          },
        ],
      })
    );
  });

  it("copies a target weight and unit when supplied", async () => {
    await saveTemplate({
      name: "Push A",
      exercises: [
        { exerciseId: "sys-1", targetSets: 3, targetReps: 8, targetWeight: 82.5, targetWeightUnit: "lb" },
      ],
    });
    expect(rpc).toHaveBeenCalledWith(
      "save_workout_template",
      expect.objectContaining({
        p_exercises: [
          expect.objectContaining({ target_weight: 82.5, target_weight_unit: "lb" }),
        ],
      })
    );
  });

  it("rejects an out-of-range or negative target weight", async () => {
    for (const targetWeight of [-1, 501]) {
      const result = await saveTemplate({
        name: "Push A",
        exercises: [{ exerciseId: "sys-1", targetSets: null, targetReps: null, targetWeight }],
      });
      expect(result.error).toBeTruthy();
      expect(rpc).not.toHaveBeenCalled();
    }
  });

  it("accepts a target weight of exactly 0 — a bodyweight exercise's target is 'no added weight'", async () => {
    const result = await saveTemplate({
      name: "Push A",
      exercises: [{ exerciseId: "sys-1", targetSets: null, targetReps: null, targetWeight: 0 }],
    });
    expect(result.success).toBe(true);
  });

  it("rejects an invalid weight unit", async () => {
    const result = await saveTemplate({
      name: "Push A",
      exercises: [
        { exerciseId: "sys-1", targetSets: null, targetReps: null, targetWeightUnit: "stone" },
      ],
    });
    expect(result.error).toBe("Invalid weight unit.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an exercise that is not visible to the user", async () => {
    const result = await saveTemplate({
      name: "Push A",
      exercises: [{ exerciseId: "someone-elses-exercise", targetSets: null, targetReps: null }],
    });
    expect(result.error).toBe("One of the selected exercises is no longer available.");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range target when supplied", async () => {
    const result = await saveTemplate({
      name: "Push A",
      exercises: [{ exerciseId: "sys-1", targetSets: 0, targetReps: null }],
    });
    expect(result.error).toBeTruthy();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts exercises with no target sets/reps at all", async () => {
    const result = await saveTemplate({
      name: "Push A",
      exercises: [{ exerciseId: "sys-1", targetSets: null, targetReps: null }],
    });
    expect(result.success).toBe(true);
  });

  it("updates an existing template by id instead of inserting a new one", async () => {
    const result = await saveTemplate({ templateId: "template-1", name: "Push A v2", exercises: [] });
    expect(result).toEqual({ success: true, templateId: "template-1" });
    expect(rpc).toHaveBeenCalledWith("save_workout_template", {
      p_template_id: "template-1",
      p_name: "Push A v2",
      p_exercises: [],
    });
  });

  it("shows a generic error and never the database's own message — the RPC call is a single transaction: nothing is left half-written", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "duplicate key value violates unique constraint" } });
    const result = await saveTemplate({ name: "Push A", exercises: [] });
    expect(result).toEqual({ error: "Something went wrong saving this template. Please try again." });
  });
});

describe("deleteTemplate", () => {
  beforeEach(() => {
    templatesDeleteResult.mockReset();
  });

  it("deletes a template owned by the current user", async () => {
    templatesDeleteResult.mockResolvedValue({ error: null, count: 1 });
    const result = await deleteTemplate("template-1");
    expect(result).toEqual({ success: true });
  });

  it("returns a generic error and does not throw when nothing was deleted (not this user's template)", async () => {
    templatesDeleteResult.mockResolvedValue({ error: null, count: 0 });
    const result = await deleteTemplate("someone-elses-template");
    expect(result.error).toBe("Unable to delete this template.");
  });
});
