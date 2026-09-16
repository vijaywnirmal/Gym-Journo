"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getExercises } from "@/lib/queries";
import { validateExerciseName } from "@/lib/validation";

export type CreateExerciseInput = {
  name: string;
  equipment: string;
  muscleGroupIds: string[];
};

export async function createExercise(input: CreateExerciseInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const nameError = validateExerciseName(input.name);
  if (nameError) return { error: nameError };
  const trimmedName = input.name.trim();

  // Duplicate check against everything the user can currently see (system + own custom
  // exercises) — reuses the existing RLS-scoped query rather than a separate lookup, so the
  // visibility boundary can never diverge from what the user is actually allowed to read.
  const visibleExercises = await getExercises();
  const isDuplicate = visibleExercises.some(
    (ex) => ex.name.trim().toLowerCase() === trimmedName.toLowerCase()
  );
  if (isDuplicate) return { error: "An exercise with this name already exists." };

  const equipment = input.equipment.trim() || null;

  const { data: exercise, error } = await supabase
    .from("exercises")
    .insert({ name: trimmedName, equipment, user_id: user.id })
    .select()
    .single();

  if (error || !exercise) {
    return { error: "Something went wrong creating this exercise. Please try again." };
  }

  if (input.muscleGroupIds.length > 0) {
    await supabase.from("exercise_muscle_groups").insert(
      input.muscleGroupIds.map((muscle_group_id) => ({
        exercise_id: exercise.id,
        muscle_group_id,
      }))
    );
  }

  revalidatePath("/exercises");
  return { success: true };
}

export async function deleteExercise(exerciseId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error, count } = await supabase
    .from("exercises")
    .delete({ count: "exact" })
    .eq("id", exerciseId);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "This exercise is used in a workout plan, workout log, or template and can't be deleted.",
      };
    }
    return { error: "Something went wrong deleting this exercise. Please try again." };
  }

  if (!count) {
    return { error: "Unable to delete this exercise." };
  }

  revalidatePath("/exercises");
  return { success: true };
}
