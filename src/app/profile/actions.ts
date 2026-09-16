"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  validateDateOfBirth,
  validateExperienceLevel,
  validatePassword,
  validatePrimaryGoal,
  validateTargetWeightKg,
  validateTrainingDaysPerWeek,
} from "@/lib/validation";

export type UpdateProfileInput = {
  fullName: string;
  dateOfBirth: string | null;
  heightCm: number | null;
  weightKg: number | null;
  sex: string;
  primaryGoal: string;
  targetWeightKg: number | null;
  experienceLevel: string;
  trainingDaysPerWeek: number | null;
  password?: string;
};

export async function updateProfile(input: UpdateProfileInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  if (input.dateOfBirth) {
    const dobError = validateDateOfBirth(input.dateOfBirth);
    if (dobError) return { error: dobError };
  }

  if (input.primaryGoal) {
    const primaryGoalError = validatePrimaryGoal(input.primaryGoal);
    if (primaryGoalError) return { error: primaryGoalError };
  }

  if (input.experienceLevel) {
    const experienceLevelError = validateExperienceLevel(input.experienceLevel);
    if (experienceLevelError) return { error: experienceLevelError };
  }

  if (input.trainingDaysPerWeek !== null) {
    const trainingDaysError = validateTrainingDaysPerWeek(input.trainingDaysPerWeek);
    if (trainingDaysError) return { error: trainingDaysError };
  }

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
    if (passwordError) return { error: passwordError.message };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: input.fullName || null,
      date_of_birth: input.dateOfBirth,
      height_cm: input.heightCm,
      weight_kg: input.weightKg,
      sex: input.sex || null,
      primary_goal: input.primaryGoal || null,
      target_weight_kg: input.targetWeightKg,
      experience_level: input.experienceLevel || null,
      training_days_per_week: input.trainingDaysPerWeek,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (error) return { error: error.message };

  revalidatePath("/profile");
  return { success: true };
}

// Deletes all data owned by the current user, then (if a service-role key is configured) the
// Supabase Auth user itself. The owned-row cleanup below is required even in the admin path:
// `exercises` cascades directly from auth.users, but `planned_exercises`/`logged_exercises`
// restrict deletion of a referenced exercise, and Postgres does not guarantee that the
// auth.users -> workout_plans/workout_logs cascade (which owns those referencing rows) runs
// before the auth.users -> exercises cascade in the same statement. Deleting plans and logs
// (which cascade their planned/logged children) before exercises guarantees every exercise is
// already unreferenced, so both the manual exercise delete and the eventual Auth user cascade
// are safe. Without a service-role key, the Auth user record itself is left behind — callers
// should treat `fullyDeleted: false` as "manual cleanup still required".
export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const genericError = { error: "Something went wrong deleting your account. Please try again." };

  const { error: plansError } = await supabase
    .from("workout_plans")
    .delete()
    .eq("user_id", user.id);
  if (plansError) return genericError;

  const { error: logsError } = await supabase.from("workout_logs").delete().eq("user_id", user.id);
  if (logsError) return genericError;

  const { error: exercisesError } = await supabase
    .from("exercises")
    .delete()
    .eq("user_id", user.id);
  if (exercisesError) return genericError;

  await supabase.from("ai_plans").delete().eq("user_id", user.id);
  await supabase.from("nutrition_logs").delete().eq("user_id", user.id);

  const admin = createAdminClient();
  if (admin) {
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) return genericError;
    await supabase.auth.signOut();
    return { success: true, fullyDeleted: true };
  }

  await supabase.from("profiles").delete().eq("id", user.id);
  await supabase.auth.signOut();
  return { success: true, fullyDeleted: false };
}
