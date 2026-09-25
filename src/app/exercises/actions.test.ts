import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const single = vi.fn();
const select = vi.fn().mockReturnValue({ single });
const insert = vi.fn().mockReturnValue({ select });
const deleteResult = vi.fn();
const eq = vi.fn().mockImplementation(() => deleteResult());
const del = vi.fn().mockReturnValue({ eq });
const from = vi.fn().mockReturnValue({ insert, delete: del });

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

const { createExercise, deleteExercise } = await import("./actions");

const existingExercises = [
  { id: "sys-1", user_id: null, name: "Bench Press", equipment: "Barbell", notes: null },
  { id: "custom-1", user_id: "user-1", name: "Reverse Lunge", equipment: null, notes: null },
];

describe("createExercise", () => {
  beforeEach(() => {
    getExercises.mockReset();
    single.mockReset();
    insert.mockClear();
    getExercises.mockResolvedValue(existingExercises);
  });

  it("creates a valid custom exercise", async () => {
    single.mockResolvedValue({ data: { id: "new-1" }, error: null });
    const result = await createExercise({ name: "Incline Bench Press", equipment: "Barbell", muscleGroupIds: [] });
    expect(result).toEqual({ success: true });
    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Incline Bench Press", user_id: "user-1" })
    );
  });

  it("rejects an invalid (empty) name", async () => {
    const result = await createExercise({ name: "   ", equipment: "", muscleGroupIds: [] });
    expect(result.error).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects an exact case-insensitive duplicate", async () => {
    const result = await createExercise({ name: "bench press", equipment: "", muscleGroupIds: [] });
    expect(result.error).toBe("An exercise with this name already exists.");
    expect(insert).not.toHaveBeenCalled();
  });

  it("rejects a duplicate with surrounding whitespace", async () => {
    const result = await createExercise({ name: "  Reverse Lunge  ", equipment: "", muscleGroupIds: [] });
    expect(result.error).toBe("An exercise with this name already exists.");
  });

  it("accepts a similar but distinct name", async () => {
    single.mockResolvedValue({ data: { id: "new-2" }, error: null });
    const result = await createExercise({ name: "Dumbbell Bench Press", equipment: "", muscleGroupIds: [] });
    expect(result).toEqual({ success: true });
  });

  it("returns a safe generic error on an unexpected DB failure", async () => {
    single.mockResolvedValue({ data: null, error: { message: "connection reset", code: "08000" } });
    const result = await createExercise({ name: "New Exercise", equipment: "", muscleGroupIds: [] });
    expect(result.error).toBe("Something went wrong creating this exercise. Please try again.");
    expect(result.error).not.toContain("connection reset");
  });
});

describe("deleteExercise", () => {
  beforeEach(() => {
    deleteResult.mockReset();
  });

  it("deletes an unreferenced custom exercise", async () => {
    deleteResult.mockResolvedValue({ error: null, count: 1 });
    const result = await deleteExercise("custom-1");
    expect(result).toEqual({ success: true });
  });

  it("returns a clear message when the exercise is referenced (FK violation)", async () => {
    deleteResult.mockResolvedValue({
      error: { code: "23503", message: "violates foreign key constraint" },
      count: null,
    });
    const result = await deleteExercise("custom-1");
    expect(result.error).toBe(
      "This exercise is used in a workout plan, workout log, or template and can't be deleted."
    );
  });

  it("returns a safe generic error for other DB failures", async () => {
    deleteResult.mockResolvedValue({ error: { code: "08000", message: "connection reset" }, count: null });
    const result = await deleteExercise("custom-1");
    expect(result.error).toBe("Something went wrong deleting this exercise. Please try again.");
    expect(result.error).not.toContain("connection reset");
  });

  it("returns a generic error when nothing was deleted (e.g. a system exercise or another user's exercise)", async () => {
    deleteResult.mockResolvedValue({ error: null, count: 0 });
    const result = await deleteExercise("sys-1");
    expect(result.error).toBe("Unable to delete this exercise.");
  });
});

describe("createExercise — instructions (M6)", () => {
  beforeEach(() => {
    getExercises.mockReset();
    single.mockReset();
    insert.mockClear();
    getExercises.mockResolvedValue(existingExercises);
  });

  it("saves trimmed instructions, or null when blank", async () => {
    single.mockResolvedValue({ data: { id: "new-2" }, error: null });
    await createExercise({ name: "Zercher Squat", equipment: "Barbell", instructions: "  Bar in the elbows.  ", muscleGroupIds: [] });
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ instructions: "Bar in the elbows." }));
    await createExercise({ name: "Jefferson Curl", equipment: "", instructions: "   ", muscleGroupIds: [] });
    expect(insert).toHaveBeenLastCalledWith(expect.objectContaining({ instructions: null }));
  });

  it("rejects instructions over 1000 characters", async () => {
    const result = await createExercise({ name: "Long One", equipment: "", instructions: "x".repeat(1001), muscleGroupIds: [] });
    expect(result.error).toBeTruthy();
    expect(insert).not.toHaveBeenCalled();
  });
});
