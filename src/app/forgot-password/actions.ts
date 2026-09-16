"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail } from "@/lib/validation";

export async function requestPasswordReset(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email || !isValidEmail(email)) return { error: "Enter a valid email address." };

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `http://${headerList.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always return success — do not reveal whether the account exists.
  return { success: true };
}
