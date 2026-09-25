import { describe, expect, it } from "vitest";
import { buildWorkoutSummary } from "./workoutSummary";

describe("buildWorkoutSummary", () => {
  it("totals working sets and volume, and picks each exercise's best set by estimated 1RM", () => {
    const summary = buildWorkoutSummary([
      {
        name: "Back Squat",
        sets: [
          { reps: 10, weight: 60, weightUnit: "kg", setType: "warmup" },
          { reps: 5, weight: 100, weightUnit: "kg" },
          { reps: 8, weight: 90, weightUnit: "kg" },
        ],
      },
      { name: "Plank", sets: [{ reps: null, weight: null, weightUnit: "kg" }] },
      { name: "Curl", sets: [{ reps: 12, weight: null, weightUnit: "kg" }] },
    ]);
    expect(summary.exerciseCount).toBe(2);
    expect(summary.workingSets).toBe(3);
    expect(summary.totalVolumeKg).toBe(500 + 720);
    expect(summary.exercises[0]).toEqual({ name: "Back Squat", workingSets: 2, best: { weight: 100, reps: 5, unit: "kg" } });
    expect(summary.exercises[1]).toEqual({ name: "Curl", workingSets: 1, best: null });
  });

  it("converts lb to kg for volume but keeps the best set in its logged unit", () => {
    const summary = buildWorkoutSummary([{ name: "Bench", sets: [{ reps: 1, weight: 220.46226218, weightUnit: "lb" }] }]);
    expect(summary.totalVolumeKg).toBeCloseTo(100, 5);
    expect(summary.exercises[0].best).toEqual({ weight: 220.46226218, reps: 1, unit: "lb" });
  });

  it("is empty for a workout with nothing performed", () => {
    expect(buildWorkoutSummary([{ name: "X", sets: [] }])).toEqual({
      exerciseCount: 0,
      workingSets: 0,
      totalVolumeKg: 0,
      exercises: [],
    });
  });
});
