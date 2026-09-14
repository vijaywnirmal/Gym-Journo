"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

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

  if (error) return { error: error.message };
  return { success: true };
}
