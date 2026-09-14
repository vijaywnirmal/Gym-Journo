import type { Profile } from "@/lib/types";

export type ProfileFieldsValue = {
  fullName: string;
  age: string;
  heightCm: string;
  weightKg: string;
  sex: string;
  goal: string;
};

export function profileFieldsFromProfile(profile: Profile | null): ProfileFieldsValue {
  return {
    fullName: profile?.full_name ?? "",
    age: profile?.age?.toString() ?? "",
    heightCm: profile?.height_cm?.toString() ?? "",
    weightKg: profile?.weight_kg?.toString() ?? "",
    sex: profile?.sex ?? "",
    goal: profile?.goal ?? "",
  };
}
