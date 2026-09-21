import { describe, expect, it } from "vitest";
import { buildPrompt, type AiPlanInput, type AiPlanProfile } from "./ai-plan-prompt";

const input: AiPlanInput = {
  activityLevel: "Moderate",
  dietaryPreference: "No restrictions",
  notes: "",
  mealsToday: "",
};

describe("buildPrompt", () => {
  it("includes goal, experience, training days, and target weight when present", () => {
    const profile: AiPlanProfile = {
      full_name: "Test User",
      date_of_birth: "1995-06-20",
      height_cm: 180,
      weight_kg: 80,
      gender: "male",
      primary_goal: "build_muscle",
      target_weight_kg: 85,
      experience_level: "intermediate",
      training_days_per_week: 4,
    };
    const prompt = buildPrompt(profile, input, "No history", "No schedule");
    expect(prompt).toContain("Goal: Build muscle (target weight: 85 kg)");
    expect(prompt).toContain("Experience level: intermediate");
    expect(prompt).toContain("Training days per week: 4");
  });

  it("says Gender, passes a stated gender through, and treats 'prefer not to say' as not provided", () => {
    const base: AiPlanProfile = {
      full_name: "Test User",
      date_of_birth: null,
      height_cm: null,
      weight_kg: null,
      gender: "female",
      primary_goal: null,
      target_weight_kg: null,
      experience_level: null,
      training_days_per_week: null,
    };
    const stated = buildPrompt(base, input, "h", "s");
    expect(stated).toContain("- Gender: female");
    expect(stated).not.toContain("Sex:");
    expect(buildPrompt({ ...base, gender: "prefer_not_to_say" }, input, "h", "s")).toContain("- Gender: N/A");
    expect(buildPrompt({ ...base, gender: null }, input, "h", "s")).toContain("- Gender: N/A");
  });

  it("does not crash and falls back sensibly when goal/training fields are null", () => {
    const profile: AiPlanProfile = {
      full_name: null,
      date_of_birth: null,
      height_cm: null,
      weight_kg: null,
      gender: null,
      primary_goal: null,
      target_weight_kg: null,
      experience_level: null,
      training_days_per_week: null,
    };
    const prompt = buildPrompt(profile, input, "No history", "No schedule");
    expect(prompt).toContain("Goal: General fitness");
    expect(prompt).toContain("Experience level: N/A");
    expect(prompt).toContain("Training days per week: N/A");
    expect(prompt).not.toContain("target weight");
  });
});
