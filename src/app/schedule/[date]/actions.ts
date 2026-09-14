"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type SavePlanInput = {
  date: string;
  title: string;
  muscleGroupIds: string[];
  exercises: { exerciseId: string; targetSets: number | null; targetReps: number | null }[];
};

export async function savePlan(input: SavePlanInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { data: plan, error: upsertError } = await supabase
    .from("workout_plans")
    .upsert(
      { user_id: user.id, date: input.date, title: input.title || null },
      { onConflict: "user_id,date" }
    )
    .select()
    .single();

  if (upsertError || !plan) return { error: upsertError?.message ?? "Failed to save plan" };

  await supabase.from("workout_plan_muscle_groups").delete().eq("plan_id", plan.id);
  await supabase.from("planned_exercises").delete().eq("plan_id", plan.id);

  if (input.muscleGroupIds.length > 0) {
    await supabase.from("workout_plan_muscle_groups").insert(
      input.muscleGroupIds.map((muscle_group_id) => ({ plan_id: plan.id, muscle_group_id }))
    );
  }

  if (input.exercises.length > 0) {
    await supabase.from("planned_exercises").insert(
      input.exercises.map((ex, i) => ({
        plan_id: plan.id,
        exercise_id: ex.exerciseId,
        position: i,
        target_sets: ex.targetSets,
        target_reps: ex.targetReps,
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
