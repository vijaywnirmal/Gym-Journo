import type { PlannedExercise, TemplateExercise } from "@/lib/types";
import type { ExerciseTargets } from "./ExerciseTargetEditor";

type TargetSource = Pick<
  PlannedExercise | TemplateExercise,
  "exercise_id" | "target_sets" | "target_reps" | "target_weight" | "target_weight_unit" | "exercise"
>;

// The editable targets for a saved plan's or template's exercises, in their saved order. Numbers
// become the strings the inputs hold; a missing unit defaults to kg.
export function toExerciseTargets(rows: TargetSource[] | null | undefined): ExerciseTargets {
  return new Map(
    (rows ?? []).map((row) => [
      row.exercise_id,
      {
        name: row.exercise?.name ?? "Exercise",
        targetSets: row.target_sets?.toString() ?? "",
        targetReps: row.target_reps?.toString() ?? "",
        targetWeight: row.target_weight?.toString() ?? "",
        targetWeightUnit: row.target_weight_unit || "kg",
      },
    ])
  );
}
