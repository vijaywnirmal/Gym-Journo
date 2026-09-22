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

  const { data: plan, error: upsertError } = await supabase
    .from("workout_plans")
    .upsert(
      {
        user_id: user.id,
        date: input.date,
        title: input.title || null,
        is_rest_day: input.isRestDay,
      },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (upsertError || !plan) return { error: upsertError?.message ?? "Failed to save plan" };

  await supabase.from("workout_plan_muscle_groups").delete().eq("plan_id", plan.id);
  await supabase.from("planned_exercises").delete().eq("plan_id", plan.id);

  if (!input.isRestDay && input.muscleGroupIds.length > 0) {
    await supabase.from("workout_plan_muscle_groups").insert(
      input.muscleGroupIds.map((muscle_group_id) => ({ plan_id: plan.id, muscle_group_id }))
    );
  }

  if (!input.isRestDay && input.exercises.length > 0) {
    await supabase.from("planned_exercises").insert(
      input.exercises.map((ex, i) => ({
        plan_id: plan.id,
        exercise_id: ex.exerciseId,
        position: i,
        target_sets: ex.targetSets,
        target_reps: ex.targetReps,
        target_weight: ex.targetWeight ?? null,
        target_weight_unit: ex.targetWeightUnit ?? "kg",
      }))
    );
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
