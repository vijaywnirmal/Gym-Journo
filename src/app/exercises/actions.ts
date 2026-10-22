"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { visibleExerciseNamed } from "@/lib/queries";
import { validateExerciseName } from "@/lib/validation";

export type CreateExerciseInput = {
  name: string;
  equipment: string;
  instructions?: string;
  muscleGroupIds: string[];
};

const MAX_INSTRUCTIONS_LENGTH = 1000;

export async function createExercise(input: CreateExerciseInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const nameError = validateExerciseName(input.name);
  if (nameError) return { error: nameError };
  // Runs of spaces collapse to one, so "Cable  Fly" can't sit beside "Cable Fly" looking identical.
  const trimmedName = input.name.trim().replace(/\s+/g, " ");

  // Duplicate check against everything the user can currently see (system + own custom
  // exercises): an RLS-scoped lookup, so the visibility boundary can never diverge from what the
  // user is actually allowed to read. Fails closed if the check itself can't run.
  const isDuplicate = await visibleExerciseNamed(trimmedName);
  if (isDuplicate === null) return { error: "Something went wrong creating this exercise. Please try again." };
  if (isDuplicate) return { error: "An exercise with this name already exists." };

  // Browsing is by muscle group, so an exercise without one could only be found by searching.
  if (!Array.isArray(input.muscleGroupIds) || input.muscleGroupIds.length === 0) {
    return { error: "Choose at least one muscle group." };
  }

  const equipment = input.equipment.trim() || null;
  const instructions = input.instructions?.trim() || null;
  if (instructions && instructions.length > MAX_INSTRUCTIONS_LENGTH) {
    return { error: `Instructions must be ${MAX_INSTRUCTIONS_LENGTH} characters or fewer.` };
  }

  const { data: exercise, error } = await supabase
    .from("exercises")
    .insert({ name: trimmedName, equipment, instructions, user_id: user.id })
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

// Renames one of the person's own custom exercises (RLS: "exercises update own").
export async function renameExercise(exerciseId: string, name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const nameError = validateExerciseName(name);
  if (nameError) return { error: nameError };
  const cleanName = name.trim().replace(/\s+/g, " ");

  const isDuplicate = await visibleExerciseNamed(cleanName);
  if (isDuplicate === null) return { error: "Something went wrong renaming this exercise. Please try again." };
  if (isDuplicate) return { error: "An exercise with this name already exists." };

  const { data, error } = await supabase
    .from("exercises")
    .update({ name: cleanName })
    .eq("id", exerciseId)
    .eq("user_id", user.id)
    .select("id");
  if (error || !data?.length) return { error: "Something went wrong renaming this exercise. Please try again." };

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
          "This exercise is in a workout plan, log or template. Remove it from those first, then delete it.",
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
