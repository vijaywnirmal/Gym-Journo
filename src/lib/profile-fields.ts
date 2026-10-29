import type { Profile } from "@/lib/types";
import { namePartsOf } from "@/lib/names";

export type ProfileFieldsValue = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  gender: string;
  primaryGoal: string;
  targetWeightKg: string;
  experienceLevel: string;
  trainingDaysPerWeek: string;
  trainingLocation: string;
};

export const EMPTY_PROFILE_FIELDS: ProfileFieldsValue = {
  firstName: "",
  lastName: "",
  dateOfBirth: "",
  heightCm: "",
  weightKg: "",
  gender: "",
  primaryGoal: "",
  targetWeightKg: "",
  experienceLevel: "",
  trainingDaysPerWeek: "",
  trainingLocation: "",
};

export function profileFieldsFromProfile(profile: Profile | null): ProfileFieldsValue {
  const { firstName, lastName } = namePartsOf(profile);
  return {
    firstName,
    lastName,
    dateOfBirth: profile?.date_of_birth ?? "",
    heightCm: profile?.height_cm?.toString() ?? "",
    weightKg: profile?.weight_kg?.toString() ?? "",
    gender: profile?.gender ?? "",
    primaryGoal: profile?.primary_goal ?? "",
    targetWeightKg: profile?.target_weight_kg?.toString() ?? "",
    experienceLevel: profile?.experience_level ?? "",
    trainingDaysPerWeek: profile?.training_days_per_week?.toString() ?? "",
    trainingLocation: profile?.training_location ?? "",
  };
}

// What onboarding still needs before it can finish (completeOnboarding checks the same on the
// server), in the form's order, so a member sees everything at once rather than one per attempt.
export function missingOnboardingFields(fields: ProfileFieldsValue, confirmedAdult: boolean): string[] {
  const missing: string[] = [];
  if (!fields.firstName.trim()) missing.push("your first name");
  if (!fields.gender) missing.push("gender");
  if (!fields.primaryGoal) missing.push("goal");
  if (!fields.experienceLevel) missing.push("experience level");
  if (!fields.trainingDaysPerWeek) missing.push("training days per week");
  if (!confirmedAdult) missing.push("confirming you're 18 or older");
  return missing;
}

export function missingFieldsMessage(missing: string[]): string | null {
  if (missing.length === 0) return null;
  const list = missing.length === 1 ? missing[0] : `${missing.slice(0, -1).join(", ")} and ${missing[missing.length - 1]}`;
  return `Still needed: ${list}.`;
}
