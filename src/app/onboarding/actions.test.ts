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
  firstName: "Test",
  lastName: "User",
  dateOfBirth: null,
  heightCm: null,
  weightKg: null,
  gender: "prefer_not_to_say",
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

  it("requires a first name", async () => {
    const result = await completeOnboarding({ ...validInput, firstName: "  " });
    expect(result.error).toBe("Enter your first name.");
    expect(upsert).not.toHaveBeenCalled();
  });

  it("requires gender to be answered — 'prefer not to say' counts, a blank does not", async () => {
    const blank = await completeOnboarding({ ...validInput, gender: "" });
    expect(blank.error).toBe("Select your gender.");
    const bogus = await completeOnboarding({ ...validInput, gender: "banana" });
    expect(bogus.error).toBe("Select a gender option.");
    expect(upsert).not.toHaveBeenCalled();
    const ok = await completeOnboarding({ ...validInput, gender: "prefer_not_to_say" });
    expect(ok.error).toBeUndefined();
  });

  it("stores first and last name, the joined display name, and gender", async () => {
    await completeOnboarding({ ...validInput, firstName: "Vijay", lastName: "Nirmal", gender: "male" });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        first_name: "Vijay",
        last_name: "Nirmal",
        full_name: "Vijay Nirmal",
        gender: "male",
      })
    );
  });

  it("lets the last name be empty", async () => {
    const result = await completeOnboarding({ ...validInput, lastName: "" });
    expect(result.error).toBeUndefined();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ last_name: null, full_name: "Test" }));
  });

  it("completes onboarding and sets onboarded: true with valid Phase 2 data", async () => {
    const result = await completeOnboarding(validInput);
    expect(result.error).toBeUndefined();
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ onboarded: true }));
  });
});
