"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAdminGym } from "@/lib/gyms";
import { cleanName, splitFullName, validateName } from "@/lib/names";
import { normalizeWhatsapp, SIGNUP_COOKIE } from "@/lib/trainerInvites";

export type GymInput = {
  name: string;
  city: string;
  area: string;
  phone: string;
  // Asked only when the account hasn't been through onboarding (where everyone gives them).
  ownerName: string;
  confirmedAdult: boolean;
};

const MAX_GYM_LENGTH = 80;
const MAX_PLACE_LENGTH = 60;

// Creates the signed-in person's gym, or updates the one they run. For a new account this is their
// onboarding: it also sets their name and marks them onboarded, like trainer setup.
export async function saveGym(input: GymInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const name = cleanName(input.name);
  if (!name) return { error: "Enter your gym's name." };
  if (name.length > MAX_GYM_LENGTH) return { error: `Gym name must be ${MAX_GYM_LENGTH} characters or fewer.` };
  const city = cleanName(input.city) || null;
  if (city && city.length > MAX_PLACE_LENGTH) return { error: `City must be ${MAX_PLACE_LENGTH} characters or fewer.` };
  const area = cleanName(input.area) || null;
  if (area && area.length > MAX_PLACE_LENGTH) return { error: `Area must be ${MAX_PLACE_LENGTH} characters or fewer.` };
  const phone = normalizeWhatsapp(input.phone);
  if (phone === "invalid") return { error: "Enter a phone number with 10 to 15 digits." };

  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("id", user.id).maybeSingle();
  const onboarded = profile?.onboarded === true;
  const ownerName = cleanName(input.ownerName);
  if (!onboarded) {
    const nameError = validateName(ownerName, "name", true);
    if (nameError) return { error: nameError };
    if (input.confirmedAdult !== true) return { error: "Gym Journal is for people 18 or older. Please confirm your age." };
  }

  const gym = await getAdminGym();
  const { error } = gym
    ? await supabase.from("gyms").update({ name, city, area, phone }).eq("id", gym.id)
    : await supabase.rpc("create_gym", { p_name: name, p_city: city ?? "", p_area: area ?? "", p_phone: phone ?? "" });
  if (error) return { error: "Couldn't save your gym. Please try again." };

  if (!onboarded) {
    const { firstName, lastName } = splitFullName(ownerName);
    const { error: profileError } = await supabase.from("profiles").upsert({
      id: user.id,
      first_name: firstName,
      last_name: lastName || null,
      full_name: ownerName,
      onboarded: true,
      updated_at: new Date().toISOString(),
    });
    if (profileError) return { error: "Couldn't finish setting up your account. Please try again." };
  }

  (await cookies()).delete(SIGNUP_COOKIE);
  revalidatePath("/", "layout");
  return { success: true };
}
