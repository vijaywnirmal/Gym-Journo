"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { passwordSchema } from "@/lib/validation/auth";

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
    const parsedPassword = passwordSchema.safeParse(input.password);
    if (!parsedPassword.success) {
      return { error: parsedPassword.error.issues[0]?.message ?? "Invalid password." };
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

export type DeleteAccountResult = { error: string } | { success: true };

const DELETE_CONFIRMATION_PHRASE = "DELETE";

export async function deleteAccount(
  _prevState: unknown,
  formData: FormData
): Promise<DeleteAccountResult> {
  const confirmation = String(formData.get("confirmation") || "").trim();
  if (confirmation !== DELETE_CONFIRMATION_PHRASE) {
    return { error: `Type ${DELETE_CONFIRMATION_PHRASE} to confirm.` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  // Deletes the auth.users row via the service-role admin API. Every
  // user-owned table (profiles, exercises, workout_plans, workout_logs, and
  // their children) references auth.users(id) with ON DELETE CASCADE, so
  // this removes all of the user's application data along with the account —
  // there is no separate "soft delete" or hidden-profile state.
  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return {
      error:
        e instanceof Error
          ? e.message
          : "Account deletion is not configured on this server.",
    };
  }

  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: error.message };

  await supabase.auth.signOut();
  return { success: true };
}
