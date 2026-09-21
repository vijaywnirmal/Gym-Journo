import { describe, expect, it } from "vitest";
import {
  isPerformedExercise,
  isPerformedSet,
  isWorkoutDay,
  windowStart,
} from "./definitions";

const TODAY = "2026-09-21";

function set(reps: number | null, weight: number | null) {
  return { reps, weight };
}

function log(date: string, exercises: { logged_sets: { reps: number | null; weight: number | null }[] }[]) {
  return { date, logged_exercises: exercises };
}

describe("isPerformedSet", () => {
  it("9. a blank placeholder set (reps and weight both null) is not performed", () => {
    expect(isPerformedSet(set(null, null))).toBe(false);
  });

  it("10. a set with reps only is performed", () => {
    expect(isPerformedSet(set(8, null))).toBe(true);
  });

  it("11. a set with weight only is performed", () => {
    expect(isPerformedSet(set(null, 60))).toBe(true);
  });

  it("12. a set with both reps and weight is performed", () => {
    expect(isPerformedSet(set(8, 60))).toBe(true);
  });

  it("a recorded zero is content, not blank", () => {
    expect(isPerformedSet(set(0, null))).toBe(true);
    expect(isPerformedSet(set(null, 0))).toBe(true);
  });
});

describe("isPerformedExercise", () => {
  it("13. an exercise with only blank sets is not performed", () => {
    expect(isPerformedExercise({ logged_sets: [set(null, null), set(null, null)] })).toBe(false);
  });

  it("14. an exercise with at least one performed set is performed", () => {
    expect(isPerformedExercise({ logged_sets: [set(null, null), set(5, 80)] })).toBe(true);
  });

  it("an exercise with no sets at all is not performed", () => {
    expect(isPerformedExercise({ logged_sets: [] })).toBe(false);
    expect(isPerformedExercise({})).toBe(false);
    expect(isPerformedExercise({ logged_sets: null })).toBe(false);
  });
});

describe("isWorkoutDay", () => {
  it("a log with a performed exercise, dated today, is a workout day", () => {
    expect(isWorkoutDay(log(TODAY, [{ logged_sets: [set(5, 80)] }]), TODAY)).toBe(true);
  });

  it("a past performed log is a workout day", () => {
    expect(isWorkoutDay(log("2026-09-01", [{ logged_sets: [set(5, 80)] }]), TODAY)).toBe(true);
  });

  it("7. a future-dated performed log is not a workout day", () => {
    expect(isWorkoutDay(log("2026-09-22", [{ logged_sets: [set(5, 80)] }]), TODAY)).toBe(false);
  });

  it("8. an empty workout log (no exercises) is not a workout day", () => {
    expect(isWorkoutDay(log(TODAY, []), TODAY)).toBe(false);
    expect(isWorkoutDay({ date: TODAY }, TODAY)).toBe(false);
  });

  it("9. a log containing only blank planned sets is not a workout day", () => {
    const blankPlan = log(TODAY, [
      { logged_sets: [set(null, null), set(null, null), set(null, null)] },
      { logged_sets: [set(null, null)] },
    ]);
    expect(isWorkoutDay(blankPlan, TODAY)).toBe(false);
  });

  it("one performed exercise among blank ones is enough", () => {
    const mixed = log(TODAY, [
      { logged_sets: [set(null, null)] },
      { logged_sets: [set(10, null)] },
    ]);
    expect(isWorkoutDay(mixed, TODAY)).toBe(true);
  });

  it("20. performed is independent of completion: completed_at neither creates nor blocks it", () => {
    const completedButBlank = { ...log(TODAY, [{ logged_sets: [set(null, null)] }]), completed_at: "2026-09-21T10:00:00Z" };
    const performedButIncomplete = { ...log(TODAY, [{ logged_sets: [set(5, 80)] }]), completed_at: null };
    expect(isWorkoutDay(completedButBlank, TODAY)).toBe(false);
    expect(isWorkoutDay(performedButIncomplete, TODAY)).toBe(true);
  });
});

describe("windowStart (inclusive N-calendar-day window)", () => {
  it("1. last 1 day is today only", () => {
    expect(windowStart(1, TODAY)).toBe("2026-09-21");
  });

  it("2. last 7 days is today plus the previous 6 (Sep 15–21)", () => {
    expect(windowStart(7, TODAY)).toBe("2026-09-15");
  });

  it("3. last 28 days is today plus the previous 27 (Aug 25–Sep 21)", () => {
    expect(windowStart(28, TODAY)).toBe("2026-08-25");
  });

  function daysInWindow(windowDays: number): number {
    const start = windowStart(windowDays, TODAY);
    const ms = Date.parse(`${TODAY}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`);
    return ms / 86_400_000 + 1;
  }

  it("a window of N contains exactly N calendar dates", () => {
    expect(daysInWindow(1)).toBe(1);
    expect(daysInWindow(7)).toBe(7);
    expect(daysInWindow(28)).toBe(28);
  });

  it("4./5./6. today and the oldest allowed date are inside; the day before is outside", () => {
    const start = windowStart(7, TODAY);
    const inWindow = (date: string) => date >= start && date <= TODAY;
    expect(inWindow(TODAY)).toBe(true);
    expect(inWindow("2026-09-15")).toBe(true);
    expect(inWindow("2026-09-14")).toBe(false);
  });

  it("crosses month and year boundaries correctly", () => {
    expect(windowStart(7, "2026-01-03")).toBe("2025-12-28");
  });

  it("rejects a non-positive or non-integer window", () => {
    expect(() => windowStart(0, TODAY)).toThrow(RangeError);
    expect(() => windowStart(-1, TODAY)).toThrow(RangeError);
    expect(() => windowStart(2.5, TODAY)).toThrow(RangeError);
  });
});
