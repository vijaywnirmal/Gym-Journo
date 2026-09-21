import { describe, expect, it } from "vitest";
import { EMPTY_PROFILE_FIELDS, profileFieldsFromProfile, type ProfileFieldsValue } from "./profile-fields";
import { displayNameOf, summarizeProfile } from "./profileSummary";
import type { Profile } from "./types";

const full: ProfileFieldsValue = {
  firstName: "Vijay",
  lastName: "Nirmal",
  dateOfBirth: "1995-09-19",
  heightCm: "174",
  weightKg: "71",
  gender: "male",
  primaryGoal: "build_muscle",
  targetWeightKg: "75.5",
  experienceLevel: "intermediate",
  trainingDaysPerWeek: "5",
};

const rows = (fields: ProfileFieldsValue) =>
  Object.fromEntries(summarizeProfile(fields).flatMap((s) => s.rows.map((r) => [r.label, r.value])));

describe("summarizeProfile", () => {
  it("shows every field in words, with units", () => {
    expect(rows(full)).toEqual({
      "Date of birth": "Sep 19, 1995",
      Gender: "Male",
      Height: "174 cm",
      Weight: "71 kg",
      "Primary goal": "Build muscle",
      Experience: "Intermediate",
      "Training days": "5 per week",
      "Target weight": "75.5 kg",
    });
  });

  it("groups into About you and Your goal", () => {
    expect(summarizeProfile(full).map((s) => s.title)).toEqual(["About you", "Your goal"]);
  });

  it("shows 'Not set' — never blank, null or undefined — for anything missing", () => {
    const all = summarizeProfile(EMPTY_PROFILE_FIELDS).flatMap((s) => s.rows);
    expect(all.length).toBeGreaterThan(0);
    for (const r of all) {
      expect(r.value).toBe("Not set");
      expect(r.set).toBe(false);
    }
  });

  it("marks set rows as set", () => {
    expect(summarizeProfile(full).flatMap((s) => s.rows).every((r) => r.set)).toBe(true);
  });

  it("only shows a target weight for goals that use one", () => {
    expect(rows({ ...full, primaryGoal: "maintain" })).not.toHaveProperty("Target weight");
    expect(rows({ ...full, primaryGoal: "lose_fat" })).toHaveProperty("Target weight");
    // Goal chosen, target not set yet: the row is there, saying so.
    expect(rows({ ...full, targetWeightKg: "" })["Target weight"]).toBe("Not set");
  });

  it("labels 'prefer not to say' as an answer, and an unrecognised or empty gender as not set", () => {
    expect(rows({ ...full, gender: "prefer_not_to_say" }).Gender).toBe("Prefer not to say");
    expect(rows({ ...full, gender: "" }).Gender).toBe("Not set");
    expect(rows({ ...full, gender: "legacy-value" }).Gender).toBe("Not set");
  });

  it("drops trailing zeros and rejects nonsense numbers", () => {
    expect(rows({ ...full, weightKg: "71.0" }).Weight).toBe("71 kg");
    expect(rows({ ...full, weightKg: "0" }).Weight).toBe("Not set");
    expect(rows({ ...full, heightCm: "abc" }).Height).toBe("Not set");
  });
});

describe("displayNameOf", () => {
  it("joins first and last", () => {
    expect(displayNameOf(full)).toBe("Vijay Nirmal");
    expect(displayNameOf({ firstName: "Vijay", lastName: "" })).toBe("Vijay");
    expect(displayNameOf({ firstName: "", lastName: "" })).toBe("");
  });
});

describe("profileFieldsFromProfile", () => {
  const profile = (over: Partial<Profile>): Profile => ({
    id: "u",
    full_name: null,
    first_name: null,
    last_name: null,
    date_of_birth: null,
    height_cm: null,
    weight_kg: null,
    gender: null,
    primary_goal: null,
    target_weight_kg: null,
    experience_level: null,
    training_days_per_week: null,
    coach_consent_at: null,
    timezone: null,
    onboarded: true,
    ...over,
  });

  it("uses the stored first and last name", () => {
    const f = profileFieldsFromProfile(profile({ first_name: "Vijay", last_name: "Nirmal", gender: "male" }));
    expect(f).toMatchObject({ firstName: "Vijay", lastName: "Nirmal", gender: "male" });
  });

  it("splits an older full_name when no separate parts exist", () => {
    const f = profileFieldsFromProfile(profile({ full_name: "Vijay Nirmal" }));
    expect(f).toMatchObject({ firstName: "Vijay", lastName: "Nirmal" });
  });

  it("is all empty for no profile", () => {
    expect(profileFieldsFromProfile(null)).toEqual(EMPTY_PROFILE_FIELDS);
  });
});
