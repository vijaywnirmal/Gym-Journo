"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { registerSchema, firstIssueMessage } from "@/lib/validation/auth";

export type RegisterResult =
  | { error: string }
  | { success: true; needsEmailConfirmation: boolean };

export async function registerWithPassword(
  _prevState: unknown,
  formData: FormData
): Promise<RegisterResult> {
  const parsed = registerSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: firstIssueMessage(parsed.error) };

  const confirmPassword = String(formData.get("confirmPassword") || "");
  if (parsed.data.password !== confirmPassword) {
    return { error: "Passwords don't match." };
  }

  const headerList = await headers();
  const origin =
    headerList.get("origin") ?? `http://${headerList.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) return { error: error.message };

  // If Supabase's "Confirm email" setting is on, signUp succeeds but returns
  // no session until the user clicks the confirmation link — surface that as
  // a distinct success state rather than treating it as a signed-in success.
  const needsEmailConfirmation = !data.session;
  return { success: true, needsEmailConfirmation };
}
