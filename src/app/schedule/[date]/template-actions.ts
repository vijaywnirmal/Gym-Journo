"use server";

import { createClient } from "@/lib/supabase/server";
import { getExercises } from "@/lib/queries";
import {
  validateTargetReps,
  validateTargetSets,
  validateTargetWeight,
  validateTemplateName,
  WEIGHT_UNITS,
} from "@/lib/validation";

export type SaveTemplateInput = {
  templateId?: string;
  name: string;
  exercises: {
    exerciseId: string;
    targetSets: number | null;
    targetReps: number | null;
    // Optional so existing callers that don't set a target weight need not specify these.
    targetWeight?: number | null;
    targetWeightUnit?: string;
  }[];
};

export async function saveTemplate(input: SaveTemplateInput) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const nameError = validateTemplateName(input.name);
  if (nameError) return { error: nameError };
  const trimmedName = input.name.trim();

  for (const ex of input.exercises) {
    if (ex.targetSets !== null) {
      const setsError = validateTargetSets(ex.targetSets);
      if (setsError) return { error: setsError };
    }
    if (ex.targetReps !== null) {
      const repsError = validateTargetReps(ex.targetReps);
      if (repsError) return { error: repsError };
    }
    if (ex.targetWeight != null) {
      const weightError = validateTargetWeight(ex.targetWeight);
      if (weightError) return { error: weightError };
    }
    if (ex.targetWeightUnit !== undefined && !WEIGHT_UNITS.has(ex.targetWeightUnit)) {
      return { error: "Invalid weight unit." };
    }
  }

  // Every exercise must actually be visible to this user (system exercises or their own custom
  // ones) — reuses the existing RLS-scoped query so the check can never diverge from what the
  // user is really allowed to reference.
  const visibleExercises = await getExercises();
  const visibleIds = new Set(visibleExercises.map((ex) => ex.id));
  const hasInvalidExercise = input.exercises.some((ex) => !visibleIds.has(ex.exerciseId));
  if (hasInvalidExercise) {
    return { error: "One of the selected exercises is no longer available." };
  }

  let templateId = input.templateId;

  if (templateId) {
    const { error } = await supabase
      .from("workout_templates")
      .update({ name: trimmedName })
      .eq("id", templateId)
      .eq("user_id", user.id);
    if (error) return { error: "Something went wrong saving this template. Please try again." };
  } else {
    const { data: template, error } = await supabase
      .from("workout_templates")
      .insert({ user_id: user.id, name: trimmedName })
      .select()
      .single();
    if (error || !template) {
      return { error: "Something went wrong saving this template. Please try again." };
    }
    templateId = template.id;
  }

  const { error: clearError } = await supabase
    .from("template_exercises")
    .delete()
    .eq("template_id", templateId);
  if (clearError) {
    return { error: "Something went wrong saving this template. Please try again." };
  }

  if (input.exercises.length > 0) {
    const { error: insertError } = await supabase.from("template_exercises").insert(
      input.exercises.map((ex, i) => ({
        template_id: templateId,
        exercise_id: ex.exerciseId,
        position: i,
        target_sets: ex.targetSets,
        target_reps: ex.targetReps,
        target_weight: ex.targetWeight ?? null,
        target_weight_unit: ex.targetWeightUnit ?? "kg",
      }))
    );
    if (insertError) {
      return { error: "Something went wrong saving this template. Please try again." };
    }
  }

  return { success: true, templateId };
}

export async function deleteTemplate(templateId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not signed in" };

  const { error, count } = await supabase
    .from("workout_templates")
    .delete({ count: "exact" })
    .eq("id", templateId)
    .eq("user_id", user.id);

  if (error) return { error: "Something went wrong deleting this template. Please try again." };
  if (!count) return { error: "Unable to delete this template." };

  return { success: true };
}
