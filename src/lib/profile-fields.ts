import type { Profile } from "@/lib/types";

export type ProfileFieldsValue = {
  fullName: string;
  dateOfBirth: string;
  heightCm: string;
  weightKg: string;
  sex: string;
  goal: string;
};

export function profileFieldsFromProfile(profile: Profile | null): ProfileFieldsValue {
  return {
    fullName: profile?.full_name ?? "",
    dateOfBirth: profile?.date_of_birth ?? "",
    heightCm: profile?.height_cm?.toString() ?? "",
    weightKg: profile?.weight_kg?.toString() ?? "",
    sex: profile?.sex ?? "",
    goal: profile?.goal ?? "",
  };
}
