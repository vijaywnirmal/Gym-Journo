import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import type { Gym, GymMemberRow, GymTrainerOffer, GymTrainerRow } from "@/lib/types";

// The gym the signed-in person runs (as owner or admin), or null. One per person in the app for
// now; the database allows more.
export const getAdminGym = cache(async (): Promise<(Gym & { isOwner: boolean }) | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  // Both at once: the layout asks on every page.
  const [{ data: owned }, { data: staff }] = await Promise.all([
    supabase.from("gyms").select("*").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle(),
    supabase
      .from("gym_staff")
      .select("gym:gyms(*)")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .eq("status", "active")
      .order("started_at")
      .limit(1)
      .maybeSingle(),
  ]);
  if (owned) return { ...owned, isOwner: true };
  const gym = (Array.isArray(staff?.gym) ? staff.gym[0] : staff?.gym) as Gym | undefined;
  return gym ? { ...gym, isOwner: false } : null;
});

// The signed-in person's gym as a member, or null.
export const getMyGymMembership = cache(async (): Promise<{ gym: Gym; startedAt: string } | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_members")
    .select("started_at, gym:gyms(*)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  const gym = (Array.isArray(data?.gym) ? data.gym[0] : data?.gym) as Gym | undefined;
  return data && gym ? { gym, startedAt: data.started_at } : null;
});

// The gyms the signed-in person trains at.
export async function getMyTrainerGyms(): Promise<Gym[]> {
  const user = await getCurrentUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_staff")
    .select("gym:gyms(*)")
    .eq("user_id", user.id)
    .eq("role", "trainer")
    .eq("status", "active");
  return (data ?? []).flatMap((row) => (Array.isArray(row.gym) ? row.gym : row.gym ? [row.gym] : [])) as Gym[];
}

export async function getGymMembers(gymId: string): Promise<GymMemberRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gym_member_overview", { p_gym_id: gymId });
  return error || !data ? [] : (data as GymMemberRow[]);
}

export async function getGymTrainers(gymId: string): Promise<GymTrainerRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gym_trainer_overview", { p_gym_id: gymId });
  return error || !data ? [] : (data as GymTrainerRow[]);
}

// The gym's current link for each kind of invite.
export async function getGymInvites(gymId: string): Promise<Partial<Record<"admin" | "trainer" | "member", { code: string; expires_at: string | null }>>> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("gym_invites")
    .select("code, role, expires_at")
    .eq("gym_id", gymId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false });
  const now = Date.now();
  const invites: Partial<Record<"admin" | "trainer" | "member", { code: string; expires_at: string | null }>> = {};
  for (const row of data ?? []) {
    const role = row.role as "admin" | "trainer" | "member";
    if (invites[role] || (row.expires_at && new Date(row.expires_at).getTime() <= now)) continue;
    invites[role] = { code: row.code, expires_at: row.expires_at };
  }
  return invites;
}

export type GymAdminRow = { user_id: string; first_name: string | null; last_name: string | null; joined_at: string };

export async function getGymAdmins(gymId: string): Promise<GymAdminRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("gym_admin_list", { p_gym_id: gymId });
  return error || !data ? [] : (data as GymAdminRow[]);
}

// A trainer the signed-in person's gym suggested that they haven't answered yet, or null.
export const getMyGymTrainerOffer = cache(async (): Promise<GymTrainerOffer | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_gym_trainer_offer");
  return error ? null : ((data as GymTrainerOffer[] | null)?.[0] ?? null);
});
