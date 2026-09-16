"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateDateOfBirth, validatePassword } from "@/lib/validation";

export type CompleteOnboardingInput = {
  fullName: string;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  sex: string;
  goal: string;
  password?: string;
};

// Password management is independent from onboarding: a user who registered with
// email+password already has one, and a magic-link user can set one later from /profile.
export async function completeOnboarding(input: CompleteOnboardingInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (input.dateOfBirth) {
    const dobError = validateDateOfBirth(input.dateOfBirth);
    if (dobError) return { error: dobError };
  }

  if (input.password) {
    const passwordValidationError = validatePassword(input.password);
    if (passwordValidationError) return { error: passwordValidationError };

    const { error: passwordError } = await supabase.auth.updateUser({
      password: input.password,
    });
    // A user who registered with email+password may re-enter their existing password here;
    // Supabase rejects that as a no-op change, which isn't a real failure for onboarding.
    if (passwordError && passwordError.code !== "same_password") {
      return { error: passwordError.message };
    }
  }

  const { error: profileError } = await supabase.from("profiles").upsert({
    id: user.id,
    full_name: input.fullName || null,
    date_of_birth: input.dateOfBirth,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    sex: input.sex || null,
    goal: input.goal || null,
    onboarded: true,
    updated_at: new Date().toISOString(),
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/", "layout");
  return { success: true };
}
