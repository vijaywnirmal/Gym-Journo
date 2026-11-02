"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ONBOARDED_COOKIE } from "@/lib/accountStatus";

// Pauses the account: signs out everywhere and stops notifications. Nothing is deleted, and the
// gym the person owns carries on. Signing back in offers to turn it on again.
export async function disableAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("profiles")
    .update({ disabled_at: now, workout_reminders: false, updated_at: now })
    .eq("id", user.id);
  if (error) return { error: "Couldn't disable your account. Please try again." };

  await supabase.from("push_subscriptions").delete().eq("user_id", user.id);
  (await cookies()).delete(ONBOARDED_COOKIE);
  await supabase.auth.signOut({ scope: "global" });
  return { success: true };
}

export async function reactivateAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error } = await supabase
    .from("profiles")
    .update({ disabled_at: null, updated_at: new Date().toISOString() })
    .eq("id", user.id);
  if (error) return { error: "Couldn't turn your account back on. Please try again." };
  redirect("/");
}
