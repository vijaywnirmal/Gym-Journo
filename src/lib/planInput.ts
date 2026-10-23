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
