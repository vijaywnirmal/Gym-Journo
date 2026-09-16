"use server";

import { createClient } from "@/lib/supabase/server";
import { validatePassword } from "@/lib/validation";

export async function resetPassword(_prevState: unknown, formData: FormData) {
  const password = String(formData.get("password") || "");
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link has expired or already been used. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };

  return { success: true };
}
