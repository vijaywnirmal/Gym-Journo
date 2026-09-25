import { describe, expect, it } from "vitest";
import { explainSuggestion, suggestOverload, type PlannedTarget } from "./overload";
import type { ExerciseSession } from "./exerciseSessions";

const session = (date: string, ...rows: [number, number, string?, string?][]): ExerciseSession => ({
  date,
  sets: rows.map(([reps, weight, unit, setType], i) => ({
    setNumber: i + 1,
    reps,
    weight,
    weightUnit: unit ?? "kg",
    ...(setType ? { setType } : {}),
  })),
});

const target = (overrides: Partial<PlannedTarget> = {}): PlannedTarget => ({
  targetSets: 3,
  targetReps: 5,
  targetWeight: null,
  targetWeightUnit: "kg",
  ...overrides,
});

describe("suggestOverload — increase", () => {
  it("suggests +2.5 kg when every working set hit the target", () => {
    const s = suggestOverload(target(), [session("2026-09-18", [5, 100], [5, 100], [6, 100])]);
    expect(s).toMatchObject({ kind: "increase", currentWeight: 100, proposedWeight: 102.5, unit: "kg" });
    expect(s?.evidence.sets).toHaveLength(3);
  });

  it("adds exactly one step to an off-grid weight", () => {
    expect(suggestOverload(target(), [session("2026-09-18", [5, 101], [5, 101], [5, 101])])).toMatchObject({
      proposedWeight: 103.5,
    });
  });

  it("uses +5 lb for pounds", () => {
    expect(suggestOverload(target(), [session("2026-09-18", [5, 225, "lb"], [5, 225, "lb"], [5, 225, "lb"])])).toMatchObject({
      proposedWeight: 230,
      unit: "lb",
    });
  });

  it("ignores warm-ups and bases the step on the lightest of the top working sets", () => {
    const s = suggestOverload(target({ targetSets: 2 }), [
      session("2026-09-18", [10, 60, "kg", "warmup"], [5, 100], [5, 97.5], [8, 80]),
    ]);
    expect(s).toMatchObject({ currentWeight: 97.5, proposedWeight: 100 });
  });

  it("says nothing when a top set missed the target, or there are too few working sets", () => {
    expect(suggestOverload(target(), [session("2026-09-18", [5, 100], [4, 100], [5, 100])])).toBeNull();
    expect(suggestOverload(target(), [session("2026-09-18", [5, 100], [5, 100])])).toBeNull();
    expect(suggestOverload(target(), [session("2026-09-18", [5, 100], [5, 100], [5, 100, "kg", "warmup"])])).toBeNull();
  });

  it("says nothing when the plan already asks for at least the next weight", () => {
    const history = [session("2026-09-18", [5, 100], [5, 100], [5, 100])];
    expect(suggestOverload(target({ targetWeight: 102.5 }), history)).toBeNull();
    expect(suggestOverload(target({ targetWeight: 105 }), history)).toBeNull();
    expect(suggestOverload(target({ targetWeight: 100 }), history)).toMatchObject({ proposedWeight: 102.5 });
  });

  it("refuses to guess with mixed units, missing targets or no history", () => {
    expect(suggestOverload(target(), [session("2026-09-18", [5, 100], [5, 220, "lb"], [5, 100])])).toBeNull();
    expect(suggestOverload(target({ targetReps: null }), [session("2026-09-18", [5, 100], [5, 100], [5, 100])])).toBeNull();
    expect(suggestOverload(target(), [])).toBeNull();
  });
});

describe("suggestOverload — deload", () => {
  const plateau = [
    session("2026-09-18", [5, 100], [4, 100], [3, 100]),
    session("2026-09-11", [5, 100], [5, 100], [4, 100]),
    session("2026-09-04", [5, 100], [4, 100], [4, 100]),
    session("2026-08-28", [6, 100], [5, 100], [5, 100]),
  ];

  it("suggests ~90% after three sessions without beating the earlier best and a missed target", () => {
    const s = suggestOverload(target(), plateau);
    expect(s).toMatchObject({ kind: "deload", currentWeight: 100, proposedWeight: 90 });
    expect(s?.plateauBestE1rmKg).toBeCloseTo(120, 5);
  });

  it("does not deload while recent sessions are still improving, or without enough history", () => {
    const improving = [session("2026-09-18", [7, 100], [4, 100], [4, 100]), ...plateau.slice(1)];
    expect(suggestOverload(target(), improving)).toBeNull();
    expect(suggestOverload(target(), plateau.slice(0, 3))).toBeNull();
  });
});

describe("explainSuggestion", () => {
  const fmt = (d: string) => `<${d}>`;
  it("names the date, target and sets behind an increase", () => {
    const s = suggestOverload(target(), [session("2026-09-18", [5, 100], [5, 100], [5, 100])])!;
    expect(explainSuggestion(s, fmt)).toBe(
      "On <2026-09-18> every working set reached the 5-rep target (100 kg × 5, 100 kg × 5, 100 kg × 5). Next step: 102.5 kg."
    );
  });
});
