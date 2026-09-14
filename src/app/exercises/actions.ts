"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createExercise(formData: FormData) {
  const name = String(formData.get("name") || "").trim();
  const equipment = String(formData.get("equipment") || "").trim() || null;
  const muscleGroupIds = formData.getAll("muscle_group_ids").map(String);

  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: exercise, error } = await supabase
    .from("exercises")
    .insert({ name, equipment, user_id: user.id })
    .select()
    .single();

  if (error || !exercise) return;

  if (muscleGroupIds.length > 0) {
    await supabase.from("exercise_muscle_groups").insert(
      muscleGroupIds.map((muscle_group_id) => ({
        exercise_id: exercise.id,
        muscle_group_id,
      }))
    );
  }

  revalidatePath("/exercises");
}

export async function deleteExercise(exerciseId: string) {
  const supabase = await createClient();
  await supabase.from("exercises").delete().eq("id", exerciseId);
  revalidatePath("/exercises");
}
