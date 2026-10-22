"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isInviteCode } from "@/lib/trainerInvites";

// The signed-in person accepts a trainer's invite (ending any other trainer link).
export async function acceptInvite(code: string) {
  const normalized = code.trim().toLowerCase();
  if (!isInviteCode(normalized)) return { error: "This invite link doesn't work. Ask your trainer for a new one." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_trainer_invite", { p_code: normalized });
  if (error) {
    if (error.message.includes("expired")) return { error: "This invite link has expired. Ask your trainer for a new one." };
    if (error.message.includes("own invite")) return { error: "This is your own invite link." };
    if (error.message.includes("Finish setting up")) return { error: "Finish setting up your account first." };
    return { error: "Couldn't accept the invite. Please try again." };
  }
  revalidatePath("/", "layout");
  return { success: true };
}
