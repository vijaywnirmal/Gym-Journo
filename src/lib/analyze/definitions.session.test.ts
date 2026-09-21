import { describe, expect, it } from "vitest";
import { isPerformedExerciseSession } from "./definitions";

const TODAY = "2026-09-21";
const BENCH = "ex-bench";
type Sets = { reps: number | null; weight: number | null }[];
const performed: Sets = [{ reps: 5, weight: 80 }];
const blank: Sets = [
  { reps: null, weight: null },
  { reps: null, weight: null },
];

function session(date: string, ...exercises: { exercise_id: string; logged_sets: Sets }[]) {
  return { date, logged_exercises: exercises };
}

describe("isPerformedExerciseSession", () => {
  it("a log where the exercise has a performed set is a session", () => {
    expect(isPerformedExerciseSession(session("2026-09-10", { exercise_id: BENCH, logged_sets: performed }), BENCH, TODAY)).toBe(true);
  });

  it("1. a blank-only occurrence is not a session", () => {
    expect(isPerformedExerciseSession(session("2026-09-10", { exercise_id: BENCH, logged_sets: blank }), BENCH, TODAY)).toBe(false);
  });

  it("2. a future-dated performed occurrence is not a session", () => {
    expect(isPerformedExerciseSession(session("2026-09-22", { exercise_id: BENCH, logged_sets: performed }), BENCH, TODAY)).toBe(false);
  });

  it("today is not the future", () => {
    expect(isPerformedExerciseSession(session(TODAY, { exercise_id: BENCH, logged_sets: performed }), BENCH, TODAY)).toBe(true);
  });

  it("3. duplicate occurrences on one log are still a single boolean session", () => {
    const dup = session(
      "2026-09-10",
      { exercise_id: BENCH, logged_sets: blank },
      { exercise_id: BENCH, logged_sets: performed }
    );
    expect(isPerformedExerciseSession(dup, BENCH, TODAY)).toBe(true);
  });

  it("only the requested exercise's own sets count — a performed sibling does not", () => {
    const sibling = session(
      "2026-09-10",
      { exercise_id: "ex-row", logged_sets: performed },
      { exercise_id: BENCH, logged_sets: blank }
    );
    expect(isPerformedExerciseSession(sibling, BENCH, TODAY)).toBe(false);
  });

  it("a log with no exercises, or none for this exercise, is not a session", () => {
    expect(isPerformedExerciseSession({ date: "2026-09-10" }, BENCH, TODAY)).toBe(false);
    expect(isPerformedExerciseSession(session("2026-09-10"), BENCH, TODAY)).toBe(false);
  });
});
