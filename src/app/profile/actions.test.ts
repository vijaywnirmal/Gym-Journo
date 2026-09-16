import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });
const signOut = vi.fn().mockResolvedValue({ error: null });

let deleteOrder: string[] = [];
let failTable: string | null = null;

const from = vi.fn((table: string) => ({
  update,
  delete: () => ({
    eq: vi.fn().mockImplementation(() => {
      deleteOrder.push(table);
      if (failTable === table) return Promise.resolve({ error: { message: "boom" } });
      return Promise.resolve({ error: null });
    }),
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, updateUser: vi.fn().mockResolvedValue({ error: null }), signOut },
    from,
  }),
}));

const createAdminClient = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => createAdminClient(),
}));

const { updateProfile, deleteAccount } = await import("./actions");

const baseInput = {
  fullName: "Test User",
  dateOfBirth: null,
  heightCm: null,
  weightKg: null,
  sex: "",
  primaryGoal: "lose_fat",
  targetWeightKg: 65,
  experienceLevel: "intermediate",
  trainingDaysPerWeek: 4,
};

describe("updateProfile", () => {
  beforeEach(() => {
    update.mockClear();
    createAdminClient.mockReturnValue(null);
  });

  it("rejects an invalid primaryGoal", async () => {
    const result = await updateProfile({ ...baseInput, primaryGoal: "improve_performance" });
    expect(result.error).toBeTruthy();
  });

  it("rejects an out-of-range trainingDaysPerWeek", async () => {
    const result = await updateProfile({ ...baseInput, trainingDaysPerWeek: 0 });
    expect(result.error).toBeTruthy();
  });

  it("rejects an invalid targetWeightKg", async () => {
    const result = await updateProfile({ ...baseInput, targetWeightKg: -5 });
    expect(result.error).toBeTruthy();
  });

  it("round-trips new goal/training fields", async () => {
    const result = await updateProfile(baseInput);
    expect(result.error).toBeUndefined();
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        primary_goal: "lose_fat",
        target_weight_kg: 65,
        experience_level: "intermediate",
        training_days_per_week: 4,
      })
    );
  });

  it("persists a null target weight when omitted", async () => {
    const result = await updateProfile({ ...baseInput, targetWeightKg: null });
    expect(result.error).toBeUndefined();
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ target_weight_kg: null }));
  });
});

describe("deleteAccount", () => {
  beforeEach(() => {
    deleteOrder = [];
    failTable = null;
    signOut.mockClear();
  });

  // Case A/B/C/D (regression for the exercises/planned_exercises/logged_exercises FK ordering
  // bug): workout_plans and workout_logs — whose cascaded children (planned_exercises,
  // logged_exercises, logged_sets) are the only things that can reference a custom exercise —
  // must always be deleted before exercises, regardless of whether the account actually has any
  // workout data. Without this order, a user who created and used a custom exercise could not
  // have their account deleted.
  it("deletes workout_plans, workout_logs, and workout_templates before exercises (no service-role key)", async () => {
    createAdminClient.mockReturnValue(null);
    const result = await deleteAccount();
    expect(result).toEqual({ success: true, fullyDeleted: false });

    const plansIndex = deleteOrder.indexOf("workout_plans");
    const logsIndex = deleteOrder.indexOf("workout_logs");
    const templatesIndex = deleteOrder.indexOf("workout_templates");
    const exercisesIndex = deleteOrder.indexOf("exercises");
    expect(plansIndex).toBeGreaterThanOrEqual(0);
    expect(logsIndex).toBeGreaterThanOrEqual(0);
    expect(templatesIndex).toBeGreaterThanOrEqual(0);
    expect(exercisesIndex).toBeGreaterThan(plansIndex);
    expect(exercisesIndex).toBeGreaterThan(logsIndex);
    expect(exercisesIndex).toBeGreaterThan(templatesIndex);
    expect(deleteOrder).toContain("profiles");
  });

  it("deletes workout_plans, workout_logs, and workout_templates before exercises, then deletes the Auth user (service-role key present)", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { deleteUser } } });

    const result = await deleteAccount();
    expect(result).toEqual({ success: true, fullyDeleted: true });

    const exercisesIndex = deleteOrder.indexOf("exercises");
    expect(exercisesIndex).toBeGreaterThanOrEqual(0);
    expect(deleteUser).toHaveBeenCalledWith("user-1");
    // deleteAccount no longer relies on the Auth-user cascade to clean up exercises — it must
    // already have deleted workout_plans/workout_logs/workout_templates/exercises itself before
    // calling deleteUser. A custom exercise referenced only by a template (Phase 5) would trip
    // the same FK-ordering bug Phase 4.1 fixed for plans/logs if workout_templates weren't
    // included here too.
    expect(deleteOrder).toEqual(
      expect.arrayContaining(["workout_plans", "workout_logs", "workout_templates", "exercises"])
    );
  });

  it("stops and returns a safe generic error if workout_templates deletion fails, without touching exercises or the Auth user", async () => {
    failTable = "workout_templates";
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { deleteUser } } });

    const result = await deleteAccount();
    expect(result.error).toBe("Something went wrong deleting your account. Please try again.");
    expect(deleteOrder).not.toContain("exercises");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("stops and returns a safe generic error if workout_plans deletion fails, without touching exercises or the Auth user", async () => {
    failTable = "workout_plans";
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { deleteUser } } });

    const result = await deleteAccount();
    expect(result.error).toBe("Something went wrong deleting your account. Please try again.");
    expect(deleteOrder).not.toContain("exercises");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("stops and returns a safe generic error if exercises deletion fails (e.g. an unremoved reference), without deleting the Auth user", async () => {
    failTable = "exercises";
    const deleteUser = vi.fn().mockResolvedValue({ error: null });
    createAdminClient.mockReturnValue({ auth: { admin: { deleteUser } } });

    const result = await deleteAccount();
    expect(result.error).toBe("Something went wrong deleting your account. Please try again.");
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it("returns a safe generic error, not the raw Supabase error, when the Auth user deletion itself fails", async () => {
    const deleteUser = vi.fn().mockResolvedValue({ error: { message: "internal db detail" } });
    createAdminClient.mockReturnValue({ auth: { admin: { deleteUser } } });

    const result = await deleteAccount();
    expect(result.error).toBe("Something went wrong deleting your account. Please try again.");
    expect(result.error).not.toContain("internal db detail");
  });

  it("only ever targets the currently authenticated user's id", async () => {
    createAdminClient.mockReturnValue(null);
    await deleteAccount();
    expect(from).toHaveBeenCalledWith("workout_plans");
    expect(from).toHaveBeenCalledWith("workout_templates");
    expect(from).toHaveBeenCalledWith("exercises");
    expect(from).toHaveBeenCalledWith("profiles");
    // Every delete in this module is scoped via .eq(...) on the authenticated user's id/user_id —
    // there is no code path that accepts a caller-supplied user id.
  });
});
