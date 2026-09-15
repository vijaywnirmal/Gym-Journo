"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { emailSchema, signInSchema, firstIssueMessage } from "@/lib/validation/auth";

export async function sendMagicLink(_prevState: unknown, formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `http://${headerList.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function signInWithPassword(_prevState: unknown, formData: FormData) {
  const parsed = signInSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: error.message };
  return { success: true };
}

export async function resendConfirmationEmail(_prevState: unknown, formData: FormData) {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const headerList = await headers();
  const origin =
    headerList.get("origin") ?? `http://${headerList.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  // Intentionally ignore the error here too: resend() can reveal whether an
  // email is registered/confirmed, and this button is only reachable after a
  // "email not confirmed" sign-in error, so the account's existence is
  // already established — we still don't need to surface Supabase's error
  // detail beyond a generic outcome.
  await supabase.auth.resend({
    type: "signup",
    email: parsed.data,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });
  return { success: true };
}
