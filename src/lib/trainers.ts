import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/currentUser";
import type { KnownTrainer } from "@/lib/planAuthors";
import type { ClientLog, ClientOverview, ClientPlan, MyTrainer, TrainerInvite, TrainerProfile } from "@/lib/types";

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

// The signed-in person's current trainer, or null. Cached per request (Profile, Today and the
// plan labels all ask).
export const getMyTrainer = cache(async (): Promise<MyTrainer | null> => {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("trainer_clients")
    .select("id, trainer_id, started_at, gym_id, trainer:trainer_profiles(display_name, gym_name, city, whatsapp)")
    .eq("client_id", user.id)
    .eq("status", "active")
    .maybeSingle();
  // A one-to-one embed comes back as an object; typed loosely by the client library.
  const trainer = (Array.isArray(data?.trainer) ? data.trainer[0] : data?.trainer) as MyTrainer["trainer"] | undefined;
  if (!data || !trainer) return null;
  return { linkId: data.id, trainerId: data.trainer_id, startedAt: data.started_at, gymId: data.gym_id ?? null, trainer };
});

// The current trainer as plan labels name them ("Planned by Ravi").
export async function getKnownTrainer(): Promise<KnownTrainer> {
  const myTrainer = await getMyTrainer();
  return myTrainer ? { id: myTrainer.trainerId, name: myTrainer.trainer.display_name } : null;
}

// The trainer's dashboard: one row per current client.
export async function getClientOverview(): Promise<ClientOverview[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("trainer_client_overview");
  if (error || !data) return [];
  return data as ClientOverview[];
}

// One current client of the signed-in trainer, or null when they aren't (or are no longer) theirs.
export async function getClient(clientId: string): Promise<ClientOverview | null> {
  return (await getClientOverview()).find((row) => row.client_id === clientId) ?? null;
}

// A client's plans and logs in [from, to] (at most 120 days). Refused unless the signed-in person
// is the client's trainer right now.
export async function getClientPlans(clientId: string, from: string, to: string): Promise<ClientPlan[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_plans", { p_client_id: clientId, p_from: from, p_to: to });
  return error || !data ? [] : (data as ClientPlan[]);
}

export async function getClientLogs(clientId: string, from: string, to: string): Promise<ClientLog[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_logs", { p_client_id: clientId, p_from: from, p_to: to });
  return error || !data ? [] : (data as ClientLog[]);
}

export async function getClientBodyWeights(clientId: string, from: string, to: string): Promise<{ date: string; weight_kg: number }[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("client_body_weights", { p_client_id: clientId, p_from: from, p_to: to });
  return error || !data ? [] : (data as { date: string; weight_kg: number }[]).map((r) => ({ ...r, weight_kg: Number(r.weight_kg) }));
}
