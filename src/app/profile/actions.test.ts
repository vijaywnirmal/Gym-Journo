import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const update = vi.fn().mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, updateUser: vi.fn().mockResolvedValue({ error: null }) },
    from: () => ({ update }),
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => null,
}));

const { updateProfile } = await import("./actions");

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
