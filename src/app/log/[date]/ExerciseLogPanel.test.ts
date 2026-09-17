import { describe, expect, it } from "vitest";
import { compareSets, exerciseHistoryHref, formatSetComparison, type SetRow } from "./ExerciseLogPanel";
import type { PreviousPerformance } from "@/lib/queries";

function set(weight: string, reps: string, weightUnit = "kg"): SetRow {
  return { weight, reps, weightUnit };
}

function previousWith(
  sets: { setNumber: number; weight: number | null; reps: number | null; weightUnit?: string }[]
): PreviousPerformance {
  return {
    date: "2026-09-10",
    sets: sets.map((s) => ({ weightUnit: "kg", ...s })),
  };
}

describe("compareSets / formatSetComparison", () => {
  it("1. current weight higher, same reps", () => {
    const previous = previousWith([{ setNumber: 1, weight: 80, reps: 5 }]);
    const [comparison] = compareSets([set("82.5", "5")], previous);
    expect(formatSetComparison(comparison)).toBe("+2.5 kg vs last time · same reps as last time");
  });

  it("2. current weight lower, same reps", () => {
    const previous = previousWith([{ setNumber: 1, weight: 80, reps: 5 }]);
    const [comparison] = compareSets([set("77.5", "5")], previous);
    expect(formatSetComparison(comparison)).toBe("−2.5 kg vs last time · same reps as last time");
  });

  it("3. same weight, higher reps", () => {
    const previous = previousWith([{ setNumber: 1, weight: 80, reps: 5 }]);
    const [comparison] = compareSets([set("80", "6")], previous);
    expect(formatSetComparison(comparison)).toBe("same weight as last time · +1 rep vs last time");
  });

  it("4. same weight, lower reps", () => {
    const previous = previousWith([{ setNumber: 1, weight: 80, reps: 5 }]);
    const [comparison] = compareSets([set("80", "3")], previous);
    expect(formatSetComparison(comparison)).toBe("same weight as last time · −2 reps vs last time");
  });

  it("5. same weight and same reps", () => {
    const previous = previousWith([{ setNumber: 1, weight: 80, reps: 5 }]);
    const [comparison] = compareSets([set("80", "5")], previous);
    expect(formatSetComparison(comparison)).toBe("same weight as last time · same reps as last time");
  });

  it("6. previous set does not exist (no previous session at all)", () => {
    const [comparison] = compareSets([set("80", "5")], null);
    expect(comparison).toBeNull();
    expect(formatSetComparison(comparison)).toBeNull();
  });

  it("7. current set has no previous matching set number", () => {
    const previous = previousWith([
      { setNumber: 1, weight: 80, reps: 5 },
      { setNumber: 2, weight: 80, reps: 5 },
    ]);
    const [, , thirdSetComparison] = compareSets(
      [set("82.5", "5"), set("80", "6"), set("80", "5")],
      previous
    );
    expect(thirdSetComparison).toBeNull();
    expect(formatSetComparison(thirdSetComparison)).toBeNull();
  });

  it("8. weight unit mismatch — no weight delta, reps still compared", () => {
    const previous = previousWith([{ setNumber: 1, weight: 80, reps: 5, weightUnit: "kg" }]);
    const [comparison] = compareSets([set("176", "6", "lb")], previous);
    expect(comparison).toEqual({
      weight: { type: "unavailable" },
      reps: { type: "delta", delta: 1 },
    });
    expect(formatSetComparison(comparison)).toBe("+1 rep vs last time");
  });

  it("9. missing current weight — weight unavailable, reps still compared", () => {
    const previous = previousWith([{ setNumber: 1, weight: 80, reps: 5 }]);
    const [comparison] = compareSets([set("", "5")], previous);
    expect(comparison?.weight).toEqual({ type: "unavailable" });
    expect(formatSetComparison(comparison)).toBe("same reps as last time");
  });

  it("10. missing previous weight — weight unavailable, reps still compared", () => {
    const previous = previousWith([{ setNumber: 1, weight: null, reps: 5 }]);
    const [comparison] = compareSets([set("80", "5")], previous);
    expect(comparison?.weight).toEqual({ type: "unavailable" });
    expect(formatSetComparison(comparison)).toBe("same reps as last time");
  });

  it("11. missing current reps — reps unavailable, weight still compared", () => {
    const previous = previousWith([{ setNumber: 1, weight: 80, reps: 5 }]);
    const [comparison] = compareSets([set("82.5", "")], previous);
    expect(comparison?.reps).toEqual({ type: "unavailable" });
    expect(formatSetComparison(comparison)).toBe("+2.5 kg vs last time");
  });

  it("12. missing previous reps — reps unavailable, weight still compared", () => {
    const previous = previousWith([{ setNumber: 1, weight: 80, reps: null }]);
    const [comparison] = compareSets([set("82.5", "5")], previous);
    expect(comparison?.reps).toEqual({ type: "unavailable" });
    expect(formatSetComparison(comparison)).toBe("+2.5 kg vs last time");
  });

  it("13. first-time exercise / no previous session at all", () => {
    const comparisons = compareSets([set("80", "5"), set("80", "5")], null);
    expect(comparisons).toEqual([null, null]);
  });

  it("14. differing set counts — extra current sets get no comparison", () => {
    const previous = previousWith([
      { setNumber: 1, weight: 80, reps: 5 },
      { setNumber: 2, weight: 80, reps: 5 },
    ]);
    const comparisons = compareSets([set("82.5", "5"), set("80", "6"), set("80", "5")], previous);
    expect(comparisons[0]).not.toBeNull();
    expect(comparisons[1]).not.toBeNull();
    expect(comparisons[2]).toBeNull();
  });

  it("15. multiple matching set numbers — each current set matches only its own set_number", () => {
    const previous = previousWith([
      { setNumber: 1, weight: 80, reps: 5 },
      { setNumber: 2, weight: 90, reps: 3 },
      { setNumber: 3, weight: 100, reps: 1 },
    ]);
    const comparisons = compareSets([set("80", "5"), set("90", "3"), set("100", "1")], previous);
    expect(formatSetComparison(comparisons[0])).toBe("same weight as last time · same reps as last time");
    expect(formatSetComparison(comparisons[1])).toBe("same weight as last time · same reps as last time");
    expect(formatSetComparison(comparisons[2])).toBe("same weight as last time · same reps as last time");
  });

  it("never matches by array position when set numbers are out of order in the previous session", () => {
    // Previous session's sets are returned in ascending set_number order by getPreviousPerformance,
    // but this guards against any future change relying on array index instead of set_number.
    const previous: PreviousPerformance = {
      date: "2026-09-10",
      sets: [
        { setNumber: 2, weight: 90, reps: 3, weightUnit: "kg" },
        { setNumber: 1, weight: 80, reps: 5, weightUnit: "kg" },
      ],
    };
    const [firstSetComparison] = compareSets([set("80", "5")], previous);
    expect(formatSetComparison(firstSetComparison)).toBe(
      "same weight as last time · same reps as last time"
    );
  });
});

describe("exerciseHistoryHref", () => {
  it("links to the existing exercise-filtered History view with the correct exercise ID", () => {
    expect(exerciseHistoryHref("ex-123")).toBe("/history?exercise=ex-123");
  });
});
