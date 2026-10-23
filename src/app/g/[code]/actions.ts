"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isInviteCode } from "@/lib/trainerInvites";

// The signed-in person joins a gym by its link, as a member, trainer or admin (whichever the link is
// for). Returns where to go next.
export async function acceptGymInvite(code: string): Promise<{ error: string } | { next: string }> {
  const normalized = code.trim().toLowerCase();
  if (!isInviteCode(normalized)) return { error: "This invite link doesn't work. Ask the gym for a new one." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_gym_invite", { p_code: normalized });
  if (error) {
    if (error.message.includes("expired")) return { error: "This invite link has expired. Ask the gym for a new one." };
    if (error.message.includes("trainer account")) return { error: "Set up your trainer account first." };
    if (error.message.includes("Finish setting up")) return { error: "Finish setting up your account first." };
    return { error: "Couldn't join the gym. Please try again." };
  }
  revalidatePath("/", "layout");
  return { next: data === "admin" ? "/gym" : data === "trainer" ? "/trainer" : "/profile" };
}
