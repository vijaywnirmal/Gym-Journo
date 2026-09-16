import type { Profile } from "@/lib/types";

export type ProfileFieldsValue = {
  fullName: string;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  sex: string;
  primaryGoal: string;
  targetWeightKg: string;
  experienceLevel: string;
  trainingDaysPerWeek: string;
};

export function profileFieldsFromProfile(profile: Profile | null): ProfileFieldsValue {
  return {
    fullName: profile?.full_name ?? "",
    dateOfBirth: profile?.date_of_birth ?? "",
    heightCm: profile?.height_cm?.toString() ?? "",
    weightKg: profile?.weight_kg?.toString() ?? "",
    sex: profile?.sex ?? "",
    primaryGoal: profile?.primary_goal ?? "",
    targetWeightKg: profile?.target_weight_kg?.toString() ?? "",
    experienceLevel: profile?.experience_level ?? "",
    trainingDaysPerWeek: profile?.training_days_per_week?.toString() ?? "",
  };
}
