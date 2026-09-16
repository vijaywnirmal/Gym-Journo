import { describe, expect, it, vi, beforeEach } from "vitest";

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

const single = vi.fn();
const templatesInsertSelect = vi.fn().mockReturnValue({ single });
const templatesInsert = vi.fn().mockReturnValue({ select: templatesInsertSelect });
const templatesUpdateEq2 = vi.fn();
const templatesUpdateEq1 = vi.fn().mockReturnValue({ eq: templatesUpdateEq2 });
const templatesUpdate = vi.fn().mockReturnValue({ eq: templatesUpdateEq1 });
const templatesDeleteResult = vi.fn();
const templatesDeleteEq2 = vi.fn().mockImplementation(() => templatesDeleteResult());
const templatesDeleteEq1 = vi.fn().mockReturnValue({ eq: templatesDeleteEq2 });
const templatesDelete = vi.fn().mockReturnValue({ eq: templatesDeleteEq1 });

const templateExercisesDeleteResult = vi.fn().mockResolvedValue({ error: null });
const templateExercisesDeleteEq = vi.fn().mockImplementation(() => templateExercisesDeleteResult());
const templateExercisesDelete = vi.fn().mockReturnValue({ eq: templateExercisesDeleteEq });
const templateExercisesInsert = vi.fn().mockResolvedValue({ error: null });

const from = vi.fn((table: string) => {
  if (table === "workout_templates") {
    return { insert: templatesInsert, update: templatesUpdate, delete: templatesDelete };
  }
  if (table === "template_exercises") {
    return { delete: templateExercisesDelete, insert: templateExercisesInsert };
  }
  throw new Error(`Unexpected table: ${table}`);
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser },
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
    getExercises.mockReset();
    getExercises.mockResolvedValue(visibleExercises);
    single.mockReset();
    templatesInsert.mockClear();
    templatesUpdate.mockClear();
    templateExercisesInsert.mockClear();
  });

  it("rejects an empty/whitespace name", async () => {
    const result = await saveTemplate({ name: "   ", exercises: [] });
    expect(result.error).toBeTruthy();
    expect(templatesInsert).not.toHaveBeenCalled();
  });

  it("rejects a name over the maximum length", async () => {
    const result = await saveTemplate({ name: "a".repeat(101), exercises: [] });
    expect(result.error).toBeTruthy();
  });

  it("creates a new template with trimmed name and no exercises", async () => {
    single.mockResolvedValue({ data: { id: "template-1" }, error: null });
    const result = await saveTemplate({ name: "  Push A  ", exercises: [] });
    expect(result).toEqual({ success: true, templateId: "template-1" });
    expect(templatesInsert).toHaveBeenCalledWith({ user_id: "user-1", name: "Push A" });
    expect(templateExercisesInsert).not.toHaveBeenCalled();
  });

  it("inserts template_exercises in position order with copied targets", async () => {
    single.mockResolvedValue({ data: { id: "template-1" }, error: null });
    const result = await saveTemplate({
      name: "Push A",
      exercises: [
        { exerciseId: "sys-1", targetSets: 3, targetReps: 8 },
        { exerciseId: "custom-1", targetSets: null, targetReps: null },
      ],
    });
    expect(result.success).toBe(true);
    expect(templateExercisesInsert).toHaveBeenCalledWith([
      { template_id: "template-1", exercise_id: "sys-1", position: 0, target_sets: 3, target_reps: 8 },
      {
        template_id: "template-1",
        exercise_id: "custom-1",
        position: 1,
        target_sets: null,
        target_reps: null,
      },
    ]);
  });

  it("rejects an exercise that is not visible to the user", async () => {
    const result = await saveTemplate({
      name: "Push A",
      exercises: [{ exerciseId: "someone-elses-exercise", targetSets: null, targetReps: null }],
    });
    expect(result.error).toBe("One of the selected exercises is no longer available.");
    expect(templatesInsert).not.toHaveBeenCalled();
  });

  it("rejects an out-of-range target when supplied", async () => {
    const result = await saveTemplate({
      name: "Push A",
      exercises: [{ exerciseId: "sys-1", targetSets: 0, targetReps: null }],
    });
    expect(result.error).toBeTruthy();
    expect(templatesInsert).not.toHaveBeenCalled();
  });

  it("accepts exercises with no target sets/reps at all", async () => {
    single.mockResolvedValue({ data: { id: "template-1" }, error: null });
    const result = await saveTemplate({
      name: "Push A",
      exercises: [{ exerciseId: "sys-1", targetSets: null, targetReps: null }],
    });
    expect(result.success).toBe(true);
  });

  it("updates an existing template by id instead of inserting a new one", async () => {
    templatesUpdateEq2.mockResolvedValue({ error: null });
    const result = await saveTemplate({ templateId: "template-1", name: "Push A v2", exercises: [] });
    expect(result).toEqual({ success: true, templateId: "template-1" });
    expect(templatesUpdate).toHaveBeenCalledWith({ name: "Push A v2" });
    expect(templatesInsert).not.toHaveBeenCalled();
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
