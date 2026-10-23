"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { cleanName, splitFullName, validateName } from "@/lib/names";
import { GYM_JOIN_COOKIE, gymJoinCodeOf, isInviteCode, normalizeWhatsapp, SIGNUP_COOKIE } from "@/lib/trainerInvites";

export type TrainerProfileInput = {
  displayName: string;
  gymName: string;
  city: string;
  whatsapp: string;
  // Only asked when the account hasn't been through onboarding (where everyone confirms it).
  confirmedAdult: boolean;
  // The gym join page that sent them here (/g/<code>), to go back to.
  next?: string;
};

const MAX_GYM_LENGTH = 80;
const MAX_CITY_LENGTH = 60;

// Creates or updates the signed-in person's trainer profile. For a new account this is their
// onboarding: it also sets their name and marks them onboarded, skipping the body and goal
// questions (they can fill those in later to use the journal themselves). next is the gym trainer
// link they came from, if any: given by the join page, or remembered from before signing up.
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

  const store = await cookies();
  // The gym link remembered from before signing up only matters for a new account: someone already
  // set up who edits their details stays out of an old link.
  const remembered = onboarded ? undefined : store.get(GYM_JOIN_COOKIE)?.value;
  const gymCode = gymJoinCodeOf(input.next ?? "") ?? (isInviteCode(remembered) ? remembered : null);
  store.delete(SIGNUP_COOKIE);
  if (gymCode) store.delete(GYM_JOIN_COOKIE);
  revalidatePath("/", "layout");
  return { success: true, next: gymCode ? `/g/${gymCode}` : null };
}
