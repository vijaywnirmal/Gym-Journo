"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validatePlannedExercises, validateWorkoutNotEmpty } from "@/lib/planInput";
import { isDayType, offKindOf, type DayType } from "@/lib/dayType";

export type SavePlanInput = {
  date: string;
  title: string;
  dayType: DayType;
  muscleGroupIds: string[];
  exercises: {
    exerciseId: string;
    targetSets: number | null;
    targetReps: number | null;
    // Optional so existing callers that don't set a target weight need not specify these.
    targetWeight?: number | null;
    targetWeightUnit?: string;
  }[];
};

export async function savePlan(input: SavePlanInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };
  if (!isDayType(input.dayType)) return { error: "Invalid day type." };

  const targetsError = validatePlannedExercises(input.exercises);
  if (targetsError) return { error: targetsError };

  // A day off carries no muscle groups or exercises (save_workout_plan enforces this too).
  const offKind = offKindOf(input.dayType);
  const muscleGroupIds = offKind ? [] : input.muscleGroupIds;
  const exercises = offKind ? [] : input.exercises;
  const emptyError = validateWorkoutNotEmpty({ offKind, title: input.title, muscleGroupIds, exercises });
  if (emptyError) return { error: emptyError };

  // Single RPC call = single transaction: either the whole plan is replaced, or (on any error)
  // nothing changes — see save_workout_plan in 0018_add_save_workout_plan_rpc.sql. Replaces what
  // used to be five separate, unguarded round trips (upsert, two deletes, two inserts), where a
  // failure partway through could leave a plan saved with no exercises.
  const { data, error } = await supabase.rpc("save_workout_plan", {
    p_date: input.date,
    p_title: input.title || null,
    // Whether a day off was marked after the fact is decided by the database, not sent from here.
    p_off_kind: offKind,
    p_muscle_group_ids: muscleGroupIds,
    p_exercises: exercises.map((ex, i) => ({
      exercise_id: ex.exerciseId,
      position: i,
      target_sets: ex.targetSets,
      target_reps: ex.targetReps,
      target_weight: ex.targetWeight ?? null,
      target_weight_unit: ex.targetWeightUnit ?? "kg",
    })),
  });

  if (error || !data) {
    return { error: "Couldn't save your schedule. Please try again." };
  }

  revalidatePath(`/schedule/${input.date}`);
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}

export async function deletePlan(planId: string, date: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data, error } = await supabase
    .from("workout_plans")
    .delete()
    .eq("id", planId)
    .eq("user_id", user.id)
    .select("id");
  if (error) return { error: "Couldn't remove the plan. Please try again." };
  if (!data?.length) return { error: "This plan was already removed." };
  revalidatePath(`/schedule/${date}`);
  revalidatePath("/calendar");
  revalidatePath("/");
  return { success: true };
}
