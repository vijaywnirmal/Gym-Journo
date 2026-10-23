"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";

// The signed-in person leaves a gym they're a member of; the trainer the gym arranged stops
// training them.
export async function leaveGym(gymId: string) {
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_gym_membership", { p_gym_id: gymId, p_user_id: user.id });
  if (error) return { error: "Couldn't leave the gym. Please try again." };
  revalidatePath("/", "layout");
  return { success: true };
}

// The signed-in person stops being a trainer or admin at a gym.
export async function leaveGymStaff(gymId: string, role: "admin" | "trainer") {
  if (role !== "admin" && role !== "trainer") return { error: "Couldn't leave the gym. Please try again." };
  const user = await getCurrentUser();
  if (!user) return { error: "Not signed in" };
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_gym_staff", { p_gym_id: gymId, p_user_id: user.id, p_role: role });
  if (error) return { error: "Couldn't leave the gym. Please try again." };
  revalidatePath("/", "layout");
  return { success: true };
}

// The member accepts or declines the trainer their gym suggested.
export async function answerTrainerOffer(offerId: string, accept: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("respond_gym_trainer_offer", { p_offer_id: offerId, p_accept: accept === true });
  if (error) {
    if (error.message.includes("no longer open")) {
      revalidatePath("/", "layout");
      return { error: "This suggestion is no longer open." };
    }
    return { error: "Couldn't answer. Please try again." };
  }
  revalidatePath("/", "layout");
  // false: they have their own trainer now, who stays; the suggestion was withdrawn.
  if (data === false) return { error: "You have your own trainer, so this suggestion was withdrawn." };
  return { success: true };
}
