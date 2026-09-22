"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { validateTargetWeight, WEIGHT_UNITS } from "@/lib/validation";

export type SavePlanInput = {
  date: string;
  title: string;
  isRestDay: boolean;
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

  for (const ex of input.exercises) {
    if (ex.targetWeight != null) {
      const weightError = validateTargetWeight(ex.targetWeight);
      if (weightError) return { error: weightError };
    }
    if (ex.targetWeightUnit !== undefined && !WEIGHT_UNITS.has(ex.targetWeightUnit)) {
      return { error: "Invalid weight unit." };
    }
  }

  // A rest day carries no muscle groups or exercises — same rule the previous write path applied,
  // now decided before the call instead of by guarding each of several separate statements.
  const muscleGroupIds = input.isRestDay ? [] : input.muscleGroupIds;
  const exercises = input.isRestDay ? [] : input.exercises;

  // Single RPC call = single transaction: either the whole plan is replaced, or (on any error)
  // nothing changes — see save_workout_plan in 0018_add_save_workout_plan_rpc.sql. Replaces what
  // used to be five separate, unguarded round trips (upsert, two deletes, two inserts), where a
  // failure partway through could leave a plan saved with no exercises.
  const { data, error } = await supabase.rpc("save_workout_plan", {
    p_date: input.date,
    p_title: input.title || null,
    p_is_rest_day: input.isRestDay,
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
  await supabase.from("workout_plans").delete().eq("id", planId);
  revalidatePath(`/schedule/${date}`);
  revalidatePath("/calendar");
  revalidatePath("/");
}
