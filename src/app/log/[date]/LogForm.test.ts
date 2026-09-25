import { describe, expect, it } from "vitest";
import {
  getUnloggedPlannedExercises,
  isExerciseEntryLogged,
  type PlannedExerciseRef,
} from "./LogForm";
import type { ExerciseEntry, SetRow } from "./ExerciseLogPanel";

function planned(exerciseId: string, name = exerciseId): PlannedExerciseRef {
  return { exerciseId, name };
}

const THREE_PLANNED = [planned("ex-a", "Squat"), planned("ex-b", "Bench Press"), planned("ex-c", "Row")];

describe("getUnloggedPlannedExercises (Phase 14)", () => {
  it("plan with 3 exercises, log with none: all 3 are not yet logged", () => {
    const result = getUnloggedPlannedExercises(THREE_PLANNED, []);
    expect(result.map((r) => r.exerciseId)).toEqual(["ex-a", "ex-b", "ex-c"]);
  });

  it("plan with 3, log with 1: remaining 2 are returned", () => {
    const result = getUnloggedPlannedExercises(THREE_PLANNED, ["ex-a"]);
    expect(result.map((r) => r.exerciseId)).toEqual(["ex-b", "ex-c"]);
  });

  it("plan with 3, log with all 3: empty result", () => {
    const result = getUnloggedPlannedExercises(THREE_PLANNED, ["ex-a", "ex-b", "ex-c"]);
    expect(result).toEqual([]);
  });

  it("plan and log exercise order differs: correct IDs still matched", () => {
    const result = getUnloggedPlannedExercises(THREE_PLANNED, ["ex-c", "ex-a"]);
    expect(result.map((r) => r.exerciseId)).toEqual(["ex-b"]);
  });

  it("duplicate logged exercise IDs do not create duplicate missing entries", () => {
    const result = getUnloggedPlannedExercises(THREE_PLANNED, ["ex-a", "ex-a", "ex-a"]);
    expect(result.map((r) => r.exerciseId)).toEqual(["ex-b", "ex-c"]);
  });

  it("no plan (empty planned list): no planned/missing state", () => {
    const result = getUnloggedPlannedExercises([], ["ex-a"]);
    expect(result).toEqual([]);
  });

  it("empty/rest plan: no planned/missing state", () => {
    const result = getUnloggedPlannedExercises([], []);
    expect(result).toEqual([]);
  });

  it("an extra unplanned logged exercise does not cause an error and is not surfaced", () => {
    const result = getUnloggedPlannedExercises(THREE_PLANNED, ["ex-a", "ex-unplanned"]);
    expect(result.map((r) => r.exerciseId)).toEqual(["ex-b", "ex-c"]);
  });

  it("does not duplicate a planned exercise that appears twice in the planned list itself", () => {
    const result = getUnloggedPlannedExercises([planned("ex-a"), planned("ex-a")], []);
    expect(result.map((r) => r.exerciseId)).toEqual(["ex-a"]);
  });
});

function entry(overrides: Partial<ExerciseEntry> & { sets?: SetRow[] } = {}): ExerciseEntry {
  return {
    exerciseId: overrides.exerciseId ?? "ex-a",
    name: overrides.name ?? "Exercise",
    notes: overrides.notes ?? "",
    target: overrides.target ?? null,
    sets: overrides.sets ?? [{ reps: "", weight: "", weightUnit: "kg", setType: "working", rpe: "" }],
    done: overrides.done ?? false,
  };
}

describe("isExerciseEntryLogged (Phase 14)", () => {
  it("is false for a freshly plan-seeded entry with only empty sets", () => {
    expect(isExerciseEntryLogged(entry())).toBe(false);
  });

  it("is true once a set has reps entered", () => {
    expect(isExerciseEntryLogged(entry({ sets: [{ reps: "5", weight: "", weightUnit: "kg", setType: "working", rpe: "" }] }))).toBe(true);
  });

  it("is true once a set has weight entered", () => {
    expect(isExerciseEntryLogged(entry({ sets: [{ reps: "", weight: "80", weightUnit: "kg", setType: "working", rpe: "" }] }))).toBe(true);
  });

  it("is true when marked done even with blank sets", () => {
    expect(isExerciseEntryLogged(entry({ done: true }))).toBe(true);
  });

  it("treats whitespace-only values as not logged", () => {
    expect(isExerciseEntryLogged(entry({ sets: [{ reps: "  ", weight: " ", weightUnit: "kg", setType: "working", rpe: "" }] }))).toBe(false);
  });
});
