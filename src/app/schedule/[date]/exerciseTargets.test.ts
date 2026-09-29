import { describe, expect, it } from "vitest";
import type { TemplateExercise } from "@/lib/types";
import { toExerciseTargets } from "./exerciseTargets";

const row = (id: string, overrides: Partial<TemplateExercise> = {}): TemplateExercise => ({
  id: `te-${id}`,
  template_id: "t",
  exercise_id: id,
  position: 0,
  target_sets: 3,
  target_reps: 8,
  target_weight: 60,
  target_weight_unit: "kg",
  exercise: { id, user_id: null, name: `Name ${id}`, equipment: null, notes: null },
  ...overrides,
});

describe("toExerciseTargets", () => {
  it("keeps saved order and turns numbers into input strings, with the exercise name", () => {
    const targets = toExerciseTargets([row("b"), row("a", { target_weight: 72.5, target_weight_unit: "lb" })]);
    expect([...targets.keys()]).toEqual(["b", "a"]);
    expect(targets.get("a")).toEqual({
      name: "Name a",
      targetSets: "3",
      targetReps: "8",
      targetWeight: "72.5",
      targetWeightUnit: "lb",
    });
  });

  it("leaves missing targets blank, defaults the unit to kg and the name to a placeholder", () => {
    const targets = toExerciseTargets([
      row("a", { target_sets: null, target_reps: null, target_weight: null, target_weight_unit: "", exercise: undefined }),
    ]);
    expect(targets.get("a")).toEqual({ name: "Exercise", targetSets: "", targetReps: "", targetWeight: "", targetWeightUnit: "kg" });
  });

  it("is empty for no rows", () => {
    expect(toExerciseTargets(undefined).size).toBe(0);
    expect(toExerciseTargets(null).size).toBe(0);
  });
});
