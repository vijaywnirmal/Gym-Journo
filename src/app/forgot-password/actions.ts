"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { forgotPasswordSchema, firstIssueMessage } from "@/lib/validation/auth";

export type ForgotPasswordResult = { error: string } | { success: true };

// Always returns a generic success response for any syntactically valid
// email, even if no account exists for it — Supabase's resetPasswordForEmail
// itself does not report whether the address is registered, and we must not
// invent a way to leak that either.
export async function requestPasswordReset(
  _prevState: unknown,
  formData: FormData
): Promise<ForgotPasswordResult> {
  const parsed = forgotPasswordSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const headerList = await headers();
  const origin =
    headerList.get("origin") ?? `http://${headerList.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  return { success: true };
}
