"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanName, joinName, validateName } from "@/lib/names";
import {
  validateDateOfBirth,
  validateExperienceLevel,
  validateGender,
  validatePassword,
  validatePrimaryGoal,
  validateTargetWeightKg,
  validateTrainingDaysPerWeek,
} from "@/lib/validation";

export type CompleteOnboardingInput = {
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  gender: string;
  primaryGoal: string;
  targetWeightKg: number | null;
  experienceLevel: string;
  trainingDaysPerWeek: number | null;
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

  const firstNameError = validateName(input.firstName, "first name", true);
  if (firstNameError) return { error: firstNameError };
  const lastNameError = validateName(input.lastName, "last name", false);
  if (lastNameError) return { error: lastNameError };

  if (!input.gender) return { error: "Select your gender." };
  const genderError = validateGender(input.gender);
  if (genderError) return { error: genderError };

  if (!input.primaryGoal) return { error: "Select a primary goal." };
  const primaryGoalError = validatePrimaryGoal(input.primaryGoal);
  if (primaryGoalError) return { error: primaryGoalError };

  if (!input.experienceLevel) return { error: "Select your experience level." };
  const experienceLevelError = validateExperienceLevel(input.experienceLevel);
  if (experienceLevelError) return { error: experienceLevelError };

  if (input.trainingDaysPerWeek === null) {
    return { error: "Select how many days per week you want to train." };
  }
  const trainingDaysError = validateTrainingDaysPerWeek(input.trainingDaysPerWeek);
  if (trainingDaysError) return { error: trainingDaysError };

  if (input.targetWeightKg !== null) {
    const targetWeightError = validateTargetWeightKg(input.targetWeightKg);
    if (targetWeightError) return { error: targetWeightError };
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
    first_name: cleanName(input.firstName) || null,
    last_name: cleanName(input.lastName) || null,
    full_name: joinName(input.firstName, input.lastName) || null,
    date_of_birth: input.dateOfBirth,
    height_cm: input.heightCm,
    weight_kg: input.weightKg,
    gender: input.gender,
    primary_goal: input.primaryGoal,
    target_weight_kg: input.targetWeightKg,
    experience_level: input.experienceLevel,
    training_days_per_week: input.trainingDaysPerWeek,
    onboarded: true,
    updated_at: new Date().toISOString(),
  });
  if (profileError) return { error: profileError.message };

  revalidatePath("/", "layout");
  return { success: true };
}
