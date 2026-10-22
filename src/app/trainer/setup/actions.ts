"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanName, splitFullName, validateName } from "@/lib/names";
import { normalizeWhatsapp, SIGNUP_COOKIE } from "@/lib/trainerInvites";

export type TrainerProfileInput = {
  displayName: string;
  gymName: string;
  city: string;
  whatsapp: string;
  // Only asked when the account hasn't been through onboarding (where everyone confirms it).
  confirmedAdult: boolean;
};

const MAX_GYM_LENGTH = 80;
const MAX_CITY_LENGTH = 60;

// Creates or updates the signed-in person's trainer profile. For a new account this is their
// onboarding: it also sets their name and marks them onboarded, skipping the body and goal
// questions (they can fill those in later to use the journal themselves).
export async function saveTrainerProfile(input: TrainerProfileInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const displayName = cleanName(input.displayName);
  const nameError = validateName(displayName, "name", true);
  if (nameError) return { error: nameError };
  const gymName = cleanName(input.gymName) || null;
  if (gymName && gymName.length > MAX_GYM_LENGTH) return { error: `Gym must be ${MAX_GYM_LENGTH} characters or fewer.` };
  const city = cleanName(input.city) || null;
  if (city && city.length > MAX_CITY_LENGTH) return { error: `City must be ${MAX_CITY_LENGTH} characters or fewer.` };
  const whatsapp = normalizeWhatsapp(input.whatsapp);
  if (whatsapp === "invalid") return { error: "Enter a WhatsApp number with 10 to 15 digits." };

  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle();
  const onboarded = profile?.onboarded === true;
  if (!onboarded && input.confirmedAdult !== true) {
    return { error: "Gym Journal is for people 18 or older. Please confirm your age." };
  }

  const { error } = await supabase
    .from("trainer_profiles")
    .upsert({ user_id: user.id, display_name: displayName, gym_name: gymName, city, whatsapp });
  if (error) return { error: "Couldn't save your trainer details. Please try again." };

  if (!onboarded) {
    const { firstName, lastName } = splitFullName(displayName);
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      first_name: firstName,
      last_name: lastName || null,
      full_name: displayName,
      onboarded: true,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return { error: "Couldn't finish setting up your account. Please try again." };
  }

  (await cookies()).delete(SIGNUP_COOKIE);
  revalidatePath("/", "layout");
  return { success: true };
}
