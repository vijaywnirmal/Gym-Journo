"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { GymRole } from "@/lib/types";

const ROLES: GymRole[] = ["admin", "trainer", "member"];

// A new join link of one kind for the gym; its earlier link of that kind stops working.
export async function createGymInviteLink(gymId: string, role: GymRole) {
  if (!ROLES.includes(role)) return { error: "Couldn't make a link. Please try again." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_gym_invite", { p_gym_id: gymId, p_role: role });
  if (error || !data) return { error: "Couldn't make a link. Please try again." };
  revalidatePath("/gym/invite");
  return { success: true };
}
