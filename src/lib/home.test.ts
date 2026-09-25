import { describe, expect, it } from "vitest";
import {
  formatGoalSummary,
  formatPlannedExercise,
  formatTrainingFrequency,
  getGreeting,
  getWorkoutCta,
  formatAdherence,
  formatStreak,
} from "./home";

describe("getGreeting", () => {
  it("greets a named user by first name, varying by hour", () => {
    expect(getGreeting("Vijay Nirmal", 8)).toBe("Good morning, Vijay");
    expect(getGreeting("Vijay Nirmal", 14)).toBe("Good afternoon, Vijay");
    expect(getGreeting("Vijay Nirmal", 20)).toBe("Good evening, Vijay");
  });

  it("falls back to a generic greeting when full_name is null or blank", () => {
    expect(getGreeting(null, 8)).toBe("Welcome back");
    expect(getGreeting("   ", 8)).toBe("Welcome back");
  });
});

describe("formatGoalSummary", () => {
  it("maps each primary goal to a human-readable label", () => {
    expect(
      formatGoalSummary({ primary_goal: "build_muscle", training_days_per_week: 3, target_weight_kg: null })
        ?.goalLine
    ).toBe("Build muscle · 3 training days/week");
    expect(
      formatGoalSummary({ primary_goal: "lose_fat", training_days_per_week: 4, target_weight_kg: null })
        ?.goalLine
    ).toBe("Lose fat · 4 training days/week");
    expect(
      formatGoalSummary({ primary_goal: "maintain", training_days_per_week: 1, target_weight_kg: null })
        ?.goalLine
    ).toBe("Maintain · 1 training day/week");
    expect(
      formatGoalSummary({
        primary_goal: "general_fitness",
        training_days_per_week: null,
        target_weight_kg: null,
      })?.goalLine
    ).toBe("General fitness");
  });

  it("returns null when primary_goal is null, without crashing", () => {
    expect(
      formatGoalSummary({ primary_goal: null, training_days_per_week: 3, target_weight_kg: 70 })
    ).toBeNull();
  });

  it("shows target weight for build_muscle and lose_fat when present", () => {
    const summary = formatGoalSummary({
      primary_goal: "build_muscle",
      training_days_per_week: 3,
      target_weight_kg: 80,
    });
    expect(summary?.targetLine).toBe("Target: 80 kg");
  });

  it("omits target weight for maintain/general_fitness even when set", () => {
    const summary = formatGoalSummary({
      primary_goal: "maintain",
      training_days_per_week: 3,
      target_weight_kg: 80,
    });
    expect(summary?.targetLine).toBeNull();
  });

  it("omits target weight when null", () => {
    const summary = formatGoalSummary({
      primary_goal: "build_muscle",
      training_days_per_week: 3,
      target_weight_kg: null,
    });
    expect(summary?.targetLine).toBeNull();
  });
});

describe("formatTrainingFrequency (Phase 13)", () => {
  it("shows the observed count below the weekly goal (goal=4, actual=3)", () => {
    const result = formatTrainingFrequency(4, 3, 7);
    expect(result).toEqual({
      actualLine: "3 workouts in the last 7 days",
      goalLine: "Goal: 4 days/week",
    });
  });

  it("shows the observed count matching the weekly goal (goal=4, actual=4)", () => {
    const result = formatTrainingFrequency(4, 4, 7);
    expect(result).toEqual({
      actualLine: "4 workouts in the last 7 days",
      goalLine: "Goal: 4 days/week",
    });
  });

  it("shows a zero count without crashing or implying judgment (goal=4, actual=0)", () => {
    const result = formatTrainingFrequency(4, 0, 7);
    expect(result).toEqual({
      actualLine: "0 workouts in the last 7 days",
      goalLine: "Goal: 4 days/week",
    });
  });

  it("returns null when no weekly-frequency goal is set (goal=null)", () => {
    expect(formatTrainingFrequency(null, 5, 7)).toBeNull();
  });

  it("renders normally with singular wording for 1 workout / 1 day per week", () => {
    const result = formatTrainingFrequency(1, 1, 7);
    expect(result).toEqual({
      actualLine: "1 workout in the last 7 days",
      goalLine: "Goal: 1 day/week",
    });
  });

  it("never includes evaluative language (on track / behind / ahead / score / %)", () => {
    const result = formatTrainingFrequency(4, 3, 7);
    const combined = `${result?.actualLine} ${result?.goalLine}`.toLowerCase();
    for (const forbidden of ["on track", "behind", "ahead", "missed", "adherence", "compliance", "score", "%"]) {
      expect(combined).not.toContain(forbidden);
    }
  });
});

describe("getWorkoutCta", () => {
  it("shows Start Workout when no log exists", () => {
    expect(getWorkoutCta("2026-09-16", false, false)).toEqual({
      label: "Start Workout",
      href: "/log/2026-09-16",
    });
  });

  it("shows Continue Workout for an incomplete log", () => {
    expect(getWorkoutCta("2026-09-16", true, false)).toEqual({
      label: "Continue Workout",
      href: "/log/2026-09-16",
    });
  });

  it("shows View Log for a completed log", () => {
    expect(getWorkoutCta("2026-09-16", true, true)).toEqual({
      label: "View Log",
      href: "/log/2026-09-16",
    });
  });
});

describe("formatPlannedExercise", () => {
  const base = { name: "Bench Press", targetSets: 3, targetReps: 8, targetWeight: null, targetWeightUnit: "kg" };

  it("shows sets × reps with no weight target", () => {
    expect(formatPlannedExercise(base)).toBe("Bench Press — 3 × 8");
  });

  it("appends the target weight and its unit when set", () => {
    expect(formatPlannedExercise({ ...base, targetWeight: 80 })).toBe("Bench Press — 3 × 8 @ 80 kg");
    expect(formatPlannedExercise({ ...base, targetWeight: 82.5, targetWeightUnit: "lb" })).toBe(
      "Bench Press — 3 × 8 @ 82.5 lb"
    );
  });

  it("shows a target weight of exactly 0 — a bodyweight exercise's target, not 'no weight set'", () => {
    expect(formatPlannedExercise({ ...base, targetWeight: 0 })).toBe("Bench Press — 3 × 8 @ 0 kg");
  });

  it("falls back to '?' for a missing sets or reps target, unaffected by the weight target", () => {
    expect(formatPlannedExercise({ ...base, targetSets: null, targetReps: null })).toBe(
      "Bench Press — ? × ?"
    );
    expect(formatPlannedExercise({ ...base, targetSets: null, targetWeight: 80 })).toBe(
      "Bench Press — ? × 8 @ 80 kg"
    );
  });
});

describe("formatStreak / formatAdherence (M7)", () => {
  it("says nothing without a streak", () => {
    expect(formatStreak(0, 3)).toBeNull();
  });

  it("names the weekly goal the streak is measured against", () => {
    expect(formatStreak(4, 3)).toBe("🔥 4-week streak of 3+ workout days");
    expect(formatStreak(1, null)).toBe("🔥 1-week streak of at least 1 workout");
  });

  it("formats plan adherence, or nothing when no days were planned", () => {
    expect(formatAdherence({ planned: 7, performed: 5 }, 28)).toBe("Trained on 5 of 7 planned days in the last 28 days");
    expect(formatAdherence({ planned: 1, performed: 1 }, 28)).toBe("Trained on 1 of 1 planned day in the last 28 days");
    expect(formatAdherence(null, 28)).toBeNull();
  });
});
