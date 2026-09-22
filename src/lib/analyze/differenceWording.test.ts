import { describe, expect, it } from "vitest";
import { weightVersusEarliest, weightVersusTarget, workoutDaysVersusTarget } from "./differenceWording";
import { buildTrainingEvidence } from "./evidence";

describe("workoutDaysVersusTarget", () => {
  it("says fewer, more or the same — with no sign", () => {
    expect(workoutDaysVersusTarget(-5)).toBe("5 fewer workout days than the target");
    expect(workoutDaysVersusTarget(3)).toBe("3 more workout days than the target");
    expect(workoutDaysVersusTarget(0)).toBe("the same number of workout days as the target");
  });

  it("uses the singular for exactly one day", () => {
    expect(workoutDaysVersusTarget(1)).toBe("1 more workout day than the target");
    expect(workoutDaysVersusTarget(-1)).toBe("1 fewer workout day than the target");
  });
});

describe("weightVersusTarget", () => {
  it("says above, below or at the target, with no sign", () => {
    expect(weightVersusTarget(4)).toBe("4 kg above the target weight");
    expect(weightVersusTarget(-3.2)).toBe("3.2 kg below the target weight");
    expect(weightVersusTarget(0)).toBe("at the target weight");
  });

  it("rounds floating-point noise and treats a negligible gap as at the target", () => {
    expect(weightVersusTarget(72 - 68.7)).toBe("3.3 kg above the target weight");
    expect(weightVersusTarget(0.001)).toBe("at the target weight");
    expect(weightVersusTarget(-0.004)).toBe("at the target weight");
  });
});

describe("weightVersusEarliest", () => {
  it("says higher, lower or the same", () => {
    expect(weightVersusEarliest(2)).toBe("2 kg higher than the earliest recorded weight");
    expect(weightVersusEarliest(-1.5)).toBe("1.5 kg lower than the earliest recorded weight");
    expect(weightVersusEarliest(0)).toBe("the same as the earliest recorded weight");
  });
});

describe("no phrase ever carries a sign or a verdict", () => {
  it.each([-12, -5.5, -1, -0.5, 0, 0.5, 1, 5.5, 12])("%s", (n) => {
    for (const text of [workoutDaysVersusTarget(n), weightVersusTarget(n), weightVersusEarliest(n)]) {
      expect(text).not.toMatch(/[-−+]\d/);
      expect(text).not.toMatch(/\b(good|bad|behind|ahead|progress|improv|worse|better)/i);
    }
  });
});

describe("in the evidence Coach receives", () => {
  const evidence = buildTrainingEvidence({
    todayStr: "2026-09-21",
    profile: { primary_goal: "lose_fat", experience_level: null, training_days_per_week: 4, target_weight_kg: 65 },
    performedDates: ["2026-09-15", "2026-09-18"],
    lastPerformedWorkoutDate: "2026-09-18",
    bodyMeasurements: [
      { date: "2026-07-02", weight_kg: 70 },
      { date: "2026-09-18", weight_kg: 68 },
    ],
    exercises: [],
    exercisesTruncated: false,
  });

  it("each completed week states its difference from the target in words next to the number", () => {
    const [lastWeek, , older] = evidence.training.weekly.completedWeeks;
    expect(lastWeek.differenceFromTarget).toBe(-2);
    expect(lastWeek.differenceFromTargetWords).toBe("2 fewer workout days than the target");
    expect(older.differenceFromTarget).toBe(-4);
    expect(older.differenceFromTargetWords).toBe("4 fewer workout days than the target");
  });

  it("the in-progress week, and weeks with no target, have no wording — same as the number", () => {
    expect(evidence.training.weekly.currentWeek.differenceFromTargetWords).toBeNull();
    const noTarget = buildTrainingEvidence({
      todayStr: "2026-09-21",
      profile: null,
      performedDates: ["2026-09-15"],
      lastPerformedWorkoutDate: "2026-09-15",
      bodyMeasurements: [],
      exercises: [],
      exercisesTruncated: false,
    });
    expect(noTarget.training.weekly.completedWeeks.every((w) => w.differenceFromTargetWords === null)).toBe(true);
  });

  it("body weight states its change and its distance to the target in words", () => {
    const w = evidence.bodyWeight!;
    expect(w.changeKg).toBe(-2);
    expect(w.changeWords).toBe("2 kg lower than the earliest recorded weight");
    expect(w.distanceToTargetKg).toBe(3);
    expect(w.distanceToTargetWords).toBe("3 kg above the target weight");
  });

  it("no wording when there is nothing to compare (one measurement, or no target)", () => {
    const single = buildTrainingEvidence({
      todayStr: "2026-09-21",
      profile: { primary_goal: "maintain", experience_level: null, training_days_per_week: null, target_weight_kg: null },
      performedDates: [],
      lastPerformedWorkoutDate: null,
      bodyMeasurements: [{ date: "2026-09-18", weight_kg: 70 }],
      exercises: [],
      exercisesTruncated: false,
    });
    expect(single.bodyWeight?.changeWords).toBeNull();
    expect(single.bodyWeight?.distanceToTargetWords).toBeNull();
  });

  it("the evidence stays plain JSON", () => {
    expect(JSON.parse(JSON.stringify(evidence))).toEqual(evidence);
  });
});
