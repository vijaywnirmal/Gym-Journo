"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type UpdateProfileInput = {
  fullName: string;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  sex: string;
  goal: string;
  password?: string;
};

export async function updateProfile(input: UpdateProfileInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (input.password) {
    if (input.password.length < 6) {
      return { error: "Password must be at least 6 characters." };
    }
    const { error: passwordError } = await supabase.auth.updateUser({
      password: input.password,
    });
    if (passwordError) return { error: passwordError.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName || null,
      age: input.age,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      sex: input.sex || null,
      goal: input.goal || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true };
}
