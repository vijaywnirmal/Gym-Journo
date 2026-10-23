"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getAdminGym, getGymTrainers } from "@/lib/gyms";
import { notifyUser } from "@/lib/push/notifyUser";
import { gymOfferMessage } from "@/lib/push/trainerMessage";

// The database refuses someone who no longer runs the gym (42501 from require_gym_admin).
function refusal(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "42501") return "You no longer run this gym.";
  if (error.message.includes("own trainer")) return "This member has their own trainer.";
  if (error.message.includes("Not a member")) return "They're no longer a member.";
  if (error.message.includes("Not a trainer at this gym")) return "That trainer is no longer at your gym.";
  if (error.message.includes("own client")) return "A trainer can't be their own client.";
  return fallback;
}

function revalidateGym() {
  revalidatePath("/gym", "layout");
}

// Suggests one of the gym's trainers to a member, who accepts or declines in the app. Tells the
// member, after the response.
export async function suggestTrainer(gymId: string, memberId: string, trainerId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("offer_gym_trainer", {
    p_gym_id: gymId,
    p_member_id: memberId,
    p_trainer_id: trainerId,
  });
  if (error) return { error: refusal(error, "Couldn't suggest the trainer. Please try again.") };
  revalidateGym();
  // null: they already train with that trainer through the gym, so there's nothing to tell them.
  if (data) {
    after(async () => {
      const [gym, trainers] = await Promise.all([getAdminGym(), getGymTrainers(gymId)]);
      const trainer = trainers.find((t) => t.trainer_id === trainerId);
      if (!gym || gym.id !== gymId || !trainer) return;
      await notifyUser(memberId, gymOfferMessage({ gymName: gym.name, trainerName: trainer.display_name }));
    });
  }
  return { success: true };
}

// Takes back the trainer the gym arranged for a member, or a suggestion they haven't answered.
export async function unassignTrainer(gymId: string, memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("unassign_gym_trainer", { p_gym_id: gymId, p_member_id: memberId });
  if (error) return { error: refusal(error, "Couldn't change the trainer. Please try again.") };
  revalidateGym();
  return { success: true };
}

export async function removeMember(gymId: string, memberId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_gym_membership", { p_gym_id: gymId, p_user_id: memberId });
  if (error) return { error: refusal(error, "Couldn't remove the member. Please try again.") };
  revalidateGym();
  return { success: true };
}

export async function removeStaff(gymId: string, userId: string, role: "admin" | "trainer") {
  if (role !== "admin" && role !== "trainer") return { error: "Couldn't remove them. Please try again." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("end_gym_staff", { p_gym_id: gymId, p_user_id: userId, p_role: role });
  if (error) return { error: refusal(error, "Couldn't remove them. Please try again.") };
  revalidateGym();
  revalidatePath("/gym/invite");
  return { success: true };
}
