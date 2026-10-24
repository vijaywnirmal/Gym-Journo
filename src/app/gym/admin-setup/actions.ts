"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanName, splitFullName, validateName } from "@/lib/names";
import { GYM_JOIN_COOKIE, isInviteCode, SIGNUP_COOKIE } from "@/lib/trainerInvites";

// Onboarding for someone joining a gym's team from its admin link (front desk, a manager): just a
// name and the age check, not the body and goal questions (they can fill those in later to use the
// journal themselves). Returns the gym's join page to go back to.
export async function saveAdminProfile(input: { name: string; confirmedAdult: boolean }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const name = cleanName(input.name);
  const nameError = validateName(name, "name", true);
  if (nameError) return { error: nameError };
  if (input.confirmedAdult !== true) return { error: "Gym Journal is for people 18 or older. Please confirm your age." };

  const { firstName, lastName } = splitFullName(name);
  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    first_name: firstName,
    last_name: lastName || null,
    full_name: name,
    onboarded: true,
    updated_at: new Date().toISOString(),
  });
  if (error) return { error: "Couldn't finish setting up your account. Please try again." };

  const store = await cookies();
  const code = store.get(GYM_JOIN_COOKIE)?.value;
  store.delete(SIGNUP_COOKIE);
  store.delete(GYM_JOIN_COOKIE);
  revalidatePath("/", "layout");
  return { success: true, next: isInviteCode(code) ? `/g/${code}` : "/" };
}
