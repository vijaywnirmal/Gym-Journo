import { describe, expect, it } from "vitest";
import { bestEstimatedOneRepMax, buildProgressPoints, heaviestSet } from "./progress";
import type { ExerciseSession } from "./exerciseSessions";

const session = (date: string, ...sets: [number | null, number | null, string?][]): ExerciseSession => ({
  date,
  sets: sets.map(([reps, weight, unit], i) => ({
    setNumber: i + 1,
    reps,
    weight,
    weightUnit: unit ?? "kg",
  })),
});

describe("buildProgressPoints", () => {
  it("orders points oldest first regardless of input order", () => {
    const points = buildProgressPoints([session("2026-09-10", [5, 100]), session("2026-09-03", [5, 90])]);
    expect(points.map((p) => p.date)).toEqual(["2026-09-03", "2026-09-10"]);
  });

  it("sums reps x weight across sets for volume, converting lb to kg first", () => {
    const points = buildProgressPoints([session("2026-09-10", [10, 220.46226218, "lb"])]);
    expect(points[0].volumeKg).toBeCloseTo(1000, 1); // 10 reps x 100kg equivalent
  });

  it("skips sets missing reps or weight when computing volume and e1rm", () => {
    const points = buildProgressPoints([session("2026-09-10", [null, 100], [5, null], [5, 80])]);
    expect(points[0].volumeKg).toBe(400);
    expect(points[0].e1rmKg).toBeCloseTo(80 * (1 + 5 / 30), 5);
  });

  it("e1rm is null when no set in the session has both reps and weight", () => {
    const points = buildProgressPoints([session("2026-09-10", [null, 100], [5, null])]);
    expect(points[0].e1rmKg).toBeNull();
  });

  it("picks the single best estimated 1RM within a session, not the last set", () => {
    const points = buildProgressPoints([session("2026-09-10", [5, 80], [1, 120], [10, 60])]);
    expect(points[0].e1rmKg).toBeCloseTo(120 * (1 + 1 / 30), 5);
  });
});

describe("heaviestSet", () => {
  it("returns null when nothing was ever performed with both reps and weight", () => {
    expect(heaviestSet([session("2026-09-10", [null, null])])).toBeNull();
  });

  it("finds the heaviest set across all sessions, normalized to kg", () => {
    const result = heaviestSet([
      session("2026-09-01", [5, 100]),
      session("2026-09-10", [3, 240, "lb"]), // ~108.86 kg — heavier
    ]);
    expect(result?.date).toBe("2026-09-10");
    expect(result?.weightKg).toBeCloseTo(240 / 2.2046226218, 5);
  });

  it("breaks a tie in weight by preferring more reps", () => {
    const result = heaviestSet([session("2026-09-01", [3, 100]), session("2026-09-10", [5, 100])]);
    expect(result?.date).toBe("2026-09-10");
    expect(result?.reps).toBe(5);
  });
});

describe("bestEstimatedOneRepMax", () => {
  it("returns null when no session has a usable set", () => {
    expect(bestEstimatedOneRepMax([session("2026-09-10", [null, 100])])).toBeNull();
  });

  it("finds the best estimate across sessions, favoring a heavier low-rep set over a lighter high-rep one", () => {
    const result = bestEstimatedOneRepMax([
      session("2026-09-01", [10, 60]), // e1rm ~ 80
      session("2026-09-10", [1, 120]), // e1rm = 120
    ]);
    expect(result?.date).toBe("2026-09-10");
    expect(result?.e1rmKg).toBeCloseTo(120 * (1 + 1 / 30), 5);
  });
});

describe("warm-up sets (M4)", () => {
  const withWarmup: ExerciseSession = {
    date: "2026-09-10",
    sets: [
      { setNumber: 1, reps: 10, weight: 200, weightUnit: "kg", setType: "warmup" },
      { setNumber: 2, reps: 5, weight: 100, weightUnit: "kg", setType: "working" },
    ],
  };

  it("leave warm-ups out of volume and e1rm", () => {
    const [point] = buildProgressPoints([withWarmup]);
    expect(point.volumeKg).toBe(500);
    expect(point.e1rmKg).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });

  it("leave warm-ups out of heaviest set and best e1rm", () => {
    expect(heaviestSet([withWarmup])?.weightKg).toBe(100);
    expect(bestEstimatedOneRepMax([withWarmup])?.e1rmKg).toBeCloseTo(100 * (1 + 5 / 30), 5);
  });
});
