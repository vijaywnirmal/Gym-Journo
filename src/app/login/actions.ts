"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isValidEmail, validatePassword } from "@/lib/validation";

export async function registerWithPassword(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");

  if (!email || !isValidEmail(email)) return { error: "Enter a valid email address." };
  const passwordError = validatePassword(password);
  if (passwordError) return { error: passwordError };

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `http://${headerList.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  if (error) return { error: error.message };

  // Supabase returns a user with no identities for an email that's already registered,
  // without erroring — avoid revealing account existence either way.
  if (data.user && data.user.identities && data.user.identities.length === 0) {
    return { success: true, needsConfirmation: true };
  }

  if (data.session) return { success: true, needsConfirmation: false };
  return { success: true, needsConfirmation: true };
}

export async function resendConfirmation(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email || !isValidEmail(email)) return { error: "Enter a valid email address." };

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `http://${headerList.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email,
    options: { emailRedirectTo: `${origin}/auth/callback` },
  });

  // Don't leak whether the email exists/is already confirmed.
  if (error && error.status && error.status >= 500) return { error: "Something went wrong. Try again." };
  return { success: true };
}

export async function sendMagicLink(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  if (!email) return { error: "Enter your email." };

  const headerList = await headers();
  const origin =
    headerList.get("origin") ??
    `http://${headerList.get("host") ?? "localhost:3000"}`;

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });

  if (error) return { error: error.message };
  return { success: true };
}

export async function signInWithPassword(_prevState: unknown, formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "email_not_confirmed") {
      return { error: "Confirm your email before signing in.", needsConfirmation: true };
    }
    return { error: error.message };
  }
  return { success: true };
}
