"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isValidIsoDate } from "@/lib/date";
import { isDayType, offKindOf } from "@/lib/dayType";
import { validatePlannedExercises } from "@/lib/planInput";
import { findProgram } from "@/lib/programs";
import { programPlans, type ApplyProgramInput } from "@/lib/programPlans";
import { getClient, getClientPlans } from "@/lib/trainers";
import type { SavePlanInput } from "@/app/schedule/[date]/actions";
import type { ApplyProgramResult } from "@/app/programs/actions";

// The database refuses a trainer whose link has ended (42501 from require_trainer_of).
const NOT_YOUR_CLIENT = "You're no longer this person's trainer.";

function refusal(error: { code?: string; message: string }, fallback: string): string {
  if (error.code === "42501") return NOT_YOUR_CLIENT;
  if (error.message.includes("Unknown exercise")) {
    return "One of these exercises is a custom one your client can't see. Choose one from the shared library.";
  }
  return fallback;
}

function revalidateClient(clientId: string) {
  revalidatePath(`/trainer/clients/${clientId}`, "layout");
  revalidatePath("/trainer");
}

// savePlan (schedule/[date]/actions.ts) for a client, through save_client_plan (migration 0034).
// Bound to the client's id by the page, so the schedule form calls it like its own savePlan.
export async function saveClientPlan(clientId: string, input: SavePlanInput) {
  if (!isValidIsoDate(input.date)) return { error: "Invalid date." };
  if (!isDayType(input.dayType)) return { error: "Invalid day type." };
  const targetsError = validatePlannedExercises(input.exercises);
  if (targetsError) return { error: targetsError };

  const offKind = offKindOf(input.dayType);
  const exercises = offKind ? [] : input.exercises;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_client_plan", {
    p_client_id: clientId,
    p_date: input.date,
    p_title: input.title || null,
    p_off_kind: offKind,
    p_muscle_group_ids: offKind ? [] : input.muscleGroupIds,
    p_exercises: exercises.map((ex, i) => ({
      exercise_id: ex.exerciseId,
      position: i,
      target_sets: ex.targetSets,
      target_reps: ex.targetReps,
      target_weight: ex.targetWeight ?? null,
      target_weight_unit: ex.targetWeightUnit ?? "kg",
    })),
  });
  if (error || !data) return { error: error ? refusal(error, "Couldn't save the plan. Please try again.") : "Couldn't save the plan. Please try again." };

  revalidateClient(clientId);
  return { success: true };
}

// deletePlan for a client. The plan id is the schedule form's; the database finds it by date.
export async function deleteClientPlan(clientId: string, _planId: string, date: string) {
  if (!isValidIsoDate(date)) return { error: "Invalid date." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("delete_client_plan", { p_client_id: clientId, p_date: date });
  if (error) return { error: refusal(error, "Couldn't remove the plan. Please try again.") };
  if (!data) return { error: "This plan was already removed." };
  revalidateClient(clientId);
  return { success: true };
}

// applyProgram for a client: their today decides whether the start date is in the past.
export async function applyClientProgram(clientId: string, input: ApplyProgramInput): Promise<ApplyProgramResult> {
  const client = await getClient(clientId);
  if (!client) return { error: NOT_YOUR_CLIENT };
  const supabase = await createClient();
  const built = await programPlans(supabase, input, client.client_today);
  if ("error" in built) return built;
  const { plans } = built;

  const dates = plans.map((p) => p.date);
  const existing = await getClientPlans(clientId, dates[0], dates[dates.length - 1]);
  const alreadyPlanned = new Set(existing.map((plan) => plan.date));

  const { data: created, error } = await supabase.rpc("apply_program_for_client", { p_client_id: clientId, p_plans: plans });
  if (error || typeof created !== "number") {
    return { error: error ? refusal(error, "Couldn't schedule the program. Nothing was changed — please try again.") : "Couldn't schedule the program. Nothing was changed — please try again." };
  }

  revalidateClient(clientId);
  return {
    success: true,
    created,
    skipped: plans.length - created,
    firstDate: built.firstDate,
    createdDates: dates.filter((date) => !alreadyPlanned.has(date)),
  };
}

// undoProgram for a client: removes the plans the program created on those dates, recognised by
// the program's titles, so a plan since retitled or replaced stays.
export async function undoClientProgram(
  clientId: string,
  programId: string,
  dates: string[]
): Promise<{ error: string } | { removed: number }> {
  const program = findProgram(programId);
  if (!program) return { error: "Unknown program." };
  if (!Array.isArray(dates) || dates.length === 0 || dates.length > 200 || !dates.every(isValidIsoDate)) {
    return { error: "Nothing to undo." };
  }
  const sorted = [...dates].sort();
  const wanted = new Set(dates);
  const plans = await getClientPlans(clientId, sorted[0], sorted[sorted.length - 1]);
  const toRemove = plans.filter((plan) => wanted.has(plan.date) && plan.title?.startsWith(`${program.name} · `));

  const supabase = await createClient();
  const results = await Promise.all(
    toRemove.map((plan) => supabase.rpc("delete_client_plan", { p_client_id: clientId, p_date: plan.date }))
  );
  const failed = results.find((r) => r.error);
  revalidateClient(clientId);
  if (failed?.error) return { error: refusal(failed.error, "Couldn't undo the whole program. Please try again.") };
  return { removed: toRemove.length };
}

// The trainer ends coaching. The client keeps the plans the trainer made.
export async function endCoaching(linkId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("end_trainer_link", { p_link_id: linkId });
  if (error) return { error: "Couldn't end coaching. Please try again." };
  revalidatePath("/trainer");
  if (!data) return { error: "Coaching had already ended." };
  return { success: true };
}
