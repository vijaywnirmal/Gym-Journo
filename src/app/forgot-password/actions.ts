"use server";

import { createClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/siteUrl";
import { isValidEmail } from "@/lib/validation";

export async function requestPasswordReset(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email || !isValidEmail(email)) return { error: "Enter a valid email address." };

  const origin = await getSiteUrl();

  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/callback?next=/reset-password`,
  });

  // Always return success — do not reveal whether the account exists.
  return { success: true };
}
