"use server";

import { createClient } from "@/lib/supabase/server";
import { resetPasswordSchema, firstIssueMessage } from "@/lib/validation/auth";

export type ResetPasswordResult = { error: string } | { success: true };

export async function updatePasswordFromReset(
  _prevState: unknown,
  formData: FormData
): Promise<ResetPasswordResult> {
  const parsed = resetPasswordSchema.safeParse({ password: formData.get("password") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (parsed.data.password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const supabase = await createClient();

  // updateUser relies on the short-lived "recovery" session created when the
  // reset-password email link was exchanged in /auth/callback. If that
  // session is missing or expired, this fails rather than silently no-op'ing.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "This reset link is invalid or has expired. Request a new one." };
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: error.message };

  return { success: true };
}
