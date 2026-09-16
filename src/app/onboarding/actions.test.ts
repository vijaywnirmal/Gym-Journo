import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const upsert = vi.fn().mockResolvedValue({ error: null });
const getUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } } });

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser, updateUser: vi.fn().mockResolvedValue({ error: null }) },
    from: () => ({ upsert }),
  }),
}));

const { completeOnboarding } = await import("./actions");

const validInput = {
  fullName: "Test User",
  dateOfBirth: null,
  heightCm: null,
  weightKg: null,
  sex: "",
  primaryGoal: "build_muscle",
  targetWeightKg: null,
  experienceLevel: "beginner",
  trainingDaysPerWeek: 3,
};

describe("completeOnboarding", () => {
  beforeEach(() => {
    upsert.mockClear();
  });

  it("does not mark onboarding complete when primaryGoal is missing", async () => {
    const result = await completeOnboarding({ ...validInput, primaryGoal: "" });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not mark onboarding complete when experienceLevel is missing", async () => {
    const result = await completeOnboarding({ ...validInput, experienceLevel: "" });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not mark onboarding complete when trainingDaysPerWeek is missing", async () => {
    const result = await completeOnboarding({ ...validInput, trainingDaysPerWeek: null });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("does not mark onboarding complete when trainingDaysPerWeek is out of range", async () => {
    const result = await completeOnboarding({ ...validInput, trainingDaysPerWeek: 8 });
    expect(result.error).toBeTruthy();
    expect(upsert).not.toHaveBeenCalled();
  });

  it("completes onboarding and sets onboarded: true with valid Phase 2 data", async () => {
    const result = await completeOnboarding(validInput);
    expect(result.error).toBeUndefined();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ onboarded: true }));
  });
});
