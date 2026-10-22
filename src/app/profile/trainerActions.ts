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
