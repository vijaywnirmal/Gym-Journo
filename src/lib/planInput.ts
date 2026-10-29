import { validateTargetReps, validateTargetSets, validateTargetWeight, WEIGHT_UNITS } from "@/lib/validation";

type PlannedTargets = {
  targetSets: number | null;
  targetReps: number | null;
  targetWeight?: number | null;
  targetWeightUnit?: string;
};

// Same bounds as templates (template-actions.ts), so 0 sets or -5 reps can't be planned. Shared by
// a person's own plans and a trainer's plans for a client.
export function validatePlannedExercises(exercises: PlannedTargets[]): string | null {
  for (const ex of exercises) {
    if (ex.targetSets != null) {
      const setsError = validateTargetSets(ex.targetSets);
      if (setsError) return setsError;
    }
    if (ex.targetReps != null) {
      const repsError = validateTargetReps(ex.targetReps);
      if (repsError) return repsError;
    }
    if (ex.targetWeight != null) {
      const weightError = validateTargetWeight(ex.targetWeight);
      if (weightError) return weightError;
    }
    if (ex.targetWeightUnit !== undefined && !WEIGHT_UNITS.has(ex.targetWeightUnit)) {
      return "Invalid weight unit.";
    }
  }
  return null;
}

export const EMPTY_WORKOUT_ERROR = "Add an exercise, pick a muscle group or give the day a name first.";

// A workout day with nothing in it (no name, muscle group or exercise) would count as planned for
// reminders and adherence while saying nothing about what to do. Days off need none of these.
export function validateWorkoutNotEmpty(input: {
  offKind: string | null;
  title: string | null | undefined;
  muscleGroupIds: unknown[];
  exercises: unknown[];
}): string | null {
  if (input.offKind) return null;
  if (input.title?.trim() || input.muscleGroupIds.length > 0 || input.exercises.length > 0) return null;
  return EMPTY_WORKOUT_ERROR;
}
