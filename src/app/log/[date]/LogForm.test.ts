import { describe, expect, it } from "vitest";
import {
  completesExercise,
  getUnloggedPlannedExercises,
  isExerciseEntryLogged,
  loggedExerciseTargets,
  nextUnfinishedIndex,
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

describe("nextUnfinishedIndex (auto-advance)", () => {
  const steps = (...done: boolean[]) => done.map((d) => ({ done: d }));

  it("goes to the next exercise still to do", () => {
    expect(nextUnfinishedIndex(steps(true, false, false), 0)).toBe(1);
  });

  it("skips exercises that are already finished", () => {
    expect(nextUnfinishedIndex(steps(false, true, true, false), 0)).toBe(3);
  });

  it("wraps round to an earlier exercise that was skipped", () => {
    expect(nextUnfinishedIndex(steps(false, true, true), 2)).toBe(0);
  });

  it("returns null once everything is finished, or when there is nothing else", () => {
    expect(nextUnfinishedIndex(steps(true, true, true), 1)).toBeNull();
    expect(nextUnfinishedIndex(steps(false), 0)).toBeNull();
  });
});

describe("completesExercise (auto-advance)", () => {
  const set = (done: boolean) => ({ done });

  it("is true when ticking the last unticked set", () => {
    expect(completesExercise({ done: false, sets: [set(true), set(true), set(false)] }, 2)).toBe(true);
  });

  it("is false while other sets are still unticked", () => {
    expect(completesExercise({ done: false, sets: [set(false), set(true), set(false)] }, 2)).toBe(false);
  });

  it("is false for an exercise that is already finished, or has no sets", () => {
    expect(completesExercise({ done: true, sets: [set(false)] }, 0)).toBe(false);
    expect(completesExercise({ done: false, sets: [] }, 0)).toBe(false);
  });
});

describe("loggedExerciseTargets (after a reload)", () => {
  const target = (sets: number, weight: number | null = null) => ({ sets, reps: 10, weight, weightUnit: "kg" });
  const planned = [
    { exerciseId: "squat", target: target(2, 80) },
    { exerciseId: "bench", target: target(3, 60) },
    { exerciseId: "row", target: target(2) },
  ];

  it("gives each planned exercise its own target", () => {
    expect(loggedExerciseTargets(["squat", "bench", "row"], planned)).toEqual([target(2, 80), target(3, 60), target(2)]);
  });

  it("gives a swapped-in exercise the target of the one it replaced, without its weight", () => {
    expect(loggedExerciseTargets(["leg-press", "bench", "row"], planned)).toEqual([target(2), target(3, 60), target(2)]);
  });

  it("gives nothing to an exercise added on top, even where a removed one used to be", () => {
    // Squat still in the log (moved), so the first place isn't a swap.
    expect(loggedExerciseTargets(["curl", "squat"], planned)).toEqual([null, target(2, 80)]);
    // Beyond the planned exercises.
    expect(loggedExerciseTargets(["squat", "bench", "row", "curl"], planned)[3]).toBeNull();
  });

  it("gives nothing when nothing was planned", () => {
    expect(loggedExerciseTargets(["squat"], [])).toEqual([null]);
  });
});
