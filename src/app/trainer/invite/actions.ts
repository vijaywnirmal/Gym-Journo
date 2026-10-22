"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// A new join link for the signed-in trainer; any earlier link stops working.
export async function createInviteLink() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_trainer_invite");
  if (error || !data) return { error: "Couldn't make a link. Please try again." };
  revalidatePath("/trainer/invite");
  return { success: true };
}
