import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE_FIELDS, missingFieldsMessage, missingOnboardingFields } from "./profile-fields";

const complete = {
  ...EMPTY_PROFILE_FIELDS,
  firstName: "Maya",
  gender: "female",
  primaryGoal: "build_muscle",
  experienceLevel: "beginner",
  trainingDaysPerWeek: "3",
};

describe("missingOnboardingFields", () => {
  it("lists everything still needed, in the form's order", () => {
    expect(missingOnboardingFields(EMPTY_PROFILE_FIELDS, false)).toEqual([
      "your first name",
      "gender",
      "goal",
      "experience level",
      "training days per week",
      "confirming you're 18 or older",
    ]);
  });

  it("is empty when the required fields are filled in and the age is confirmed", () => {
    expect(missingOnboardingFields(complete, true)).toEqual([]);
  });

  it("treats a blank first name as missing, and ignores optional fields", () => {
    expect(missingOnboardingFields({ ...complete, firstName: "  " }, true)).toEqual(["your first name"]);
  });
});

describe("missingFieldsMessage", () => {
  it("joins the list into one sentence", () => {
    expect(missingFieldsMessage(["gender", "goal", "experience level"])).toBe("Still needed: gender, goal and experience level.");
    expect(missingFieldsMessage(["gender"])).toBe("Still needed: gender.");
  });

  it("is null when nothing is missing", () => {
    expect(missingFieldsMessage([])).toBeNull();
  });
});
