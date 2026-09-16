"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPreviousPerformance } from "@/lib/queries";

export type SaveLogInput = {
  date: string;
  planId: string | null;
  notes: string;
  completed: boolean;
  exercises: {
    exerciseId: string;
    sets: { reps: number | null; weight: number | null; weightUnit: string }[];
  }[];
};

const WEIGHT_UNITS = new Set(["kg", "lb"]);

// Obviously-invalid-only checks — mirrors the "loose sanity bounds" style used elsewhere in
// validation.ts. The DB also enforces reps/weight >= 0 (0009_add_logged_set_constraints.sql) as
// a second layer, since this action is the only intended write path but isn't the only
// theoretically possible one.
function validateSaveLogInput(input: SaveLogInput): string | null {
  for (const ex of input.exercises) {
    if (typeof ex.exerciseId !== "string" || !ex.exerciseId) return "Invalid exercise in workout.";
    for (const s of ex.sets) {
      if (s.reps !== null && (!Number.isInteger(s.reps) || s.reps < 0)) {
        return "Reps must be a valid non-negative number.";
      }
      if (s.weight !== null && (!Number.isFinite(s.weight) || s.weight < 0)) {
        return "Weight must be a valid non-negative number.";
      }
      if (!WEIGHT_UNITS.has(s.weightUnit)) return "Invalid weight unit.";
    }
  }
  return null;
}

export async function saveLog(input: SaveLogInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const validationError = validateSaveLogInput(input);
  if (validationError) return { error: validationError };

  // Single RPC call = single transaction: either the whole workout is replaced, or (on any
  // error) nothing changes — see save_workout_log in 0010_add_save_workout_log_rpc.sql.
  const { data, error } = await supabase.rpc("save_workout_log", {
    p_date: input.date,
    p_plan_id: input.planId,
    p_notes: input.notes || null,
    p_completed: input.completed,
    p_exercises: input.exercises.map((ex, i) => ({
      exercise_id: ex.exerciseId,
      position: i,
      sets: ex.sets.map((s, setIndex) => ({
        set_number: setIndex + 1,
        reps: s.reps,
        weight: s.weight,
        weight_unit: s.weightUnit,
      })),
    })),
  });

  if (error || !data) {
    return { error: "Couldn't save your workout. Please try again." };
  }

  revalidatePath(`/log/${input.date}`);
  revalidatePath("/history");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true as const };
}

// Client-callable lookup for an exercise added mid-session (not part of the initial page load),
// so "previous performance" context stays available even for unplanned additions.
export async function fetchPreviousPerformance(exerciseId: string, beforeDate: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getPreviousPerformance(exerciseId, beforeDate);
}
