"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// The client ends their link with their trainer. The trainer loses access at once; plans they made
// stay with the client.
export async function removeTrainer(linkId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("end_trainer_link", { p_link_id: linkId });
  if (error) return { error: "Couldn't remove your trainer. Please try again." };
  revalidatePath("/", "layout");
  if (!data) return { error: "This trainer was already removed." };
  return { success: true };
}

// The signed-in trainer stops training clients (stop_training, migration 0039). Their clients lose
// them as their trainer; plans they made stay with the clients. The account goes back to the
// workout journal, or stays a gym account if they also run one.
export async function stopTraining() {
  const supabase = await createClient();
  const { error } = await supabase.rpc("stop_training");
  if (error) return { error: "Couldn't stop training clients. Please try again." };
  revalidatePath("/", "layout");
  return { success: true };
}
