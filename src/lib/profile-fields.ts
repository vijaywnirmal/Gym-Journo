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
  };
}
