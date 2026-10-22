"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getPreviousPerformance, getPriorExerciseSessions } from "@/lib/queries";
import { getToday } from "@/lib/userDate";
import { detectPersonalRecords, type PersonalRecord } from "@/lib/analyze/personalRecords";
import { WEIGHT_UNITS } from "@/lib/validation";
import { isValidIsoDate } from "@/lib/date";
import { isSetType, isValidRpe, MAX_EXERCISE_NOTE_LENGTH, type SetType } from "@/lib/setData";

export type SaveLogInput = {
  date: string;
  planId: string | null;
  notes: string;
  completed: boolean;
  exercises: {
    exerciseId: string;
    notes?: string;
    sets: {
      reps: number | null;
      weight: number | null;
      weightUnit: string;
      setType?: SetType;
      rpe?: number | null;
    }[];
  }[];
};

// Obviously-invalid-only checks — mirrors the "loose sanity bounds" style used elsewhere in
// validation.ts. The DB also enforces reps/weight >= 0 (0009_add_logged_set_constraints.sql) as
// a second layer, since this action is the only intended write path but isn't the only
// theoretically possible one.
function validateSaveLogInput(input: SaveLogInput): string | null {
  for (const ex of input.exercises) {
    if (typeof ex.exerciseId !== "string" || !ex.exerciseId) return "Invalid exercise in workout.";
    if (ex.notes !== undefined && (typeof ex.notes !== "string" || ex.notes.length > MAX_EXERCISE_NOTE_LENGTH)) {
      return `Exercise notes must be ${MAX_EXERCISE_NOTE_LENGTH} characters or fewer.`;
    }
    for (const s of ex.sets) {
      if (s.reps !== null && (!Number.isInteger(s.reps) || s.reps < 0 || s.reps > 1000)) {
        return "Enter reps between 0 and 1000.";
      }
      if (s.weight !== null && (!Number.isFinite(s.weight) || s.weight < 0 || s.weight > 1000)) {
        return "Enter a weight between 0 and 1000.";
      }
      if (!WEIGHT_UNITS.has(s.weightUnit)) return "Invalid weight unit.";
      if (s.setType !== undefined && !isSetType(s.setType)) return "Invalid set type.";
      if (s.rpe !== undefined && s.rpe !== null && !isValidRpe(s.rpe)) return "RPE must be 1–10 in half steps.";
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
  // A log records what was done, so it can't be dated ahead of the person's own today. Planning
  // ahead is what the schedule is for.
  if (input.date > (await getToday())) return { error: "You can't log a workout for a future date." };

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
      notes: ex.notes?.trim() || null,
      sets: ex.sets.map((s, setIndex) => ({
        set_number: setIndex + 1,
        reps: s.reps,
        weight: s.weight,
        weight_unit: s.weightUnit,
        set_type: s.setType ?? "working",
        rpe: s.rpe ?? null,
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
// Deletes the day's workout log; its exercises and sets go with it (ON DELETE CASCADE). The day's
// plan, if any, stays.
export async function deleteLog(date: string) {
  if (!isValidIsoDate(date)) return { error: "Invalid date." };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data, error } = await supabase
    .from("workout_logs")
    .delete()
    .eq("user_id", user.id)
    .eq("date", date)
    .select("id");
  if (error) return { error: "Couldn't delete this workout. Please try again." };
  if (!data?.length) return { error: "This workout was already deleted." };

  revalidatePath(`/log/${date}`);
  revalidatePath("/history");
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function fetchPreviousPerformance(exerciseId: string, beforeDate: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return getPreviousPerformance(exerciseId, beforeDate);
}

// New personal records in the given (unsaved or saved) sets for `date`, keyed by exercise id,
// compared against every earlier performed session. Read-only and best-effort: any failure returns
// {} so a PR lookup can never get in the way of logging. Future-dated logs never have records.
export async function fetchPersonalRecords(
  date: string,
  exercises: SaveLogInput["exercises"]
): Promise<Record<string, PersonalRecord[]>> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};
  if (!Array.isArray(exercises) || exercises.length === 0) return {};
  if (validateSaveLogInput({ date, planId: null, notes: "", completed: false, exercises })) return {};
  if (date > (await getToday())) return {};

  const history = await getPriorExerciseSessions(
    exercises.map((ex) => ex.exerciseId),
    date
  );
  if (!history) return {};

  const result: Record<string, PersonalRecord[]> = {};
  for (const ex of exercises) {
    const records = detectPersonalRecords(
      history[ex.exerciseId] ?? [],
      ex.sets.map((s, i) => ({
        setNumber: i + 1,
        reps: s.reps,
        weight: s.weight,
        weightUnit: s.weightUnit,
        setType: s.setType ?? "working",
      }))
    );
    if (records.length > 0) result[ex.exerciseId] = records;
  }
  return result;
}
