import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import type { MyTrainer, TrainerInvite, TrainerProfile } from "@/lib/types";

// The signed-in person's trainer profile, or null when they aren't a trainer.
export async function getMyTrainerProfile(): Promise<TrainerProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("trainer_profiles").select("*").eq("user_id", user.id).maybeSingle();
  return data;
}

// The trainer's join link that still works (one at a time), or null when there's none.
export async function getCurrentInvite(): Promise<TrainerInvite | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("trainer_invites")
    .select("code, expires_at")
    .eq("trainer_id", user.id)
    .is("revoked_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

// The signed-in person's current trainer, or null.
export async function getMyTrainer(): Promise<MyTrainer | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("trainer_clients")
    .select("id, started_at, trainer:trainer_profiles(display_name, gym_name, city, whatsapp)")
    .eq("client_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  // A one-to-one embed comes back as an object; typed loosely by the client library.
  const trainer = (Array.isArray(data?.trainer) ? data.trainer[0] : data?.trainer) as MyTrainer["trainer"] | undefined;
  if (!data || !trainer) return null;
  return { linkId: data.id, startedAt: data.started_at, trainer };
}
