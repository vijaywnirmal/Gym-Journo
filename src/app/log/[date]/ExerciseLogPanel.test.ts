import { describe, expect, it } from "vitest";
import {
  compareSets,
  countLoggedSets,
  exerciseHistoryHref,
  formatRemainingPlannedSets,
  formatSetComparison,
  getRemainingPlannedSetCount,
  type SetRow,
} from "./ExerciseLogPanel";
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

function blankSets(n: number): SetRow[] {
  return Array.from({ length: n }, () => set("", ""));
}

describe("countLoggedSets (Phase 15)", () => {
  it("does not count freshly plan-seeded blank rows as logged", () => {
    expect(countLoggedSets(blankSets(3))).toBe(0);
  });

  it("counts a set with only reps filled as logged", () => {
    expect(countLoggedSets([set("", "5")])).toBe(1);
  });

  it("counts a set with only weight filled as logged", () => {
    expect(countLoggedSets([set("80", "")])).toBe(1);
  });

  it("treats whitespace-only values as not logged", () => {
    expect(countLoggedSets([set("  ", " ")])).toBe(0);
  });

  it("counts a mix of filled and blank rows correctly, regardless of order", () => {
    expect(countLoggedSets([set("80", "5"), set("", ""), set("", "3")])).toBe(2);
  });

  it("counts duplicate identical rows independently (no dedup)", () => {
    expect(countLoggedSets([set("80", "5"), set("80", "5")])).toBe(2);
  });

  it("returns 0 for an empty sets array", () => {
    expect(countLoggedSets([])).toBe(0);
  });
});

describe("getRemainingPlannedSetCount (Phase 15)", () => {
  it("1. target 3, zero logged sets: all 3 remain", () => {
    expect(getRemainingPlannedSetCount(3, 0)).toBe(3);
  });

  it("2. target 3, one logged set: 2 remain", () => {
    expect(getRemainingPlannedSetCount(3, 1)).toBe(2);
  });

  it("3. target 3, two logged sets: 1 remains", () => {
    expect(getRemainingPlannedSetCount(3, 2)).toBe(1);
  });

  it("4. target 3, exactly three logged sets: none remain (null)", () => {
    expect(getRemainingPlannedSetCount(3, 3)).toBeNull();
  });

  it("5. target 3, four logged sets: none remain, not an error (null)", () => {
    expect(getRemainingPlannedSetCount(3, 4)).toBeNull();
  });

  it("6. target missing/null: no awareness (null)", () => {
    expect(getRemainingPlannedSetCount(null, 0)).toBeNull();
    expect(getRemainingPlannedSetCount(undefined, 0)).toBeNull();
  });

  it("7. target zero: no awareness (null)", () => {
    expect(getRemainingPlannedSetCount(0, 0)).toBeNull();
  });

  it("8. target negative/invalid: no awareness (null)", () => {
    expect(getRemainingPlannedSetCount(-1, 0)).toBeNull();
    expect(getRemainingPlannedSetCount(Number.NaN, 0)).toBeNull();
  });

  it("9. no target at all (unplanned/freeform exercise): no awareness (null)", () => {
    expect(getRemainingPlannedSetCount(undefined, 5)).toBeNull();
  });

  it("11. does not produce invalid output for an unusual logged count (more than target, or zero target with zero logged)", () => {
    expect(getRemainingPlannedSetCount(3, 100)).toBeNull();
    expect(Number.isNaN(getRemainingPlannedSetCount(3, 0))).toBe(false);
  });
});

describe("countLoggedSets + getRemainingPlannedSetCount integration (Phase 15)", () => {
  it("10. a planned exercise entry pre-seeded with blank sets shows the full target as remaining", () => {
    // Mirrors LogForm's initial seeding: sets.length === target_sets from the very first render,
    // but none of them have content yet.
    const targetSets = 3;
    const seededSets = blankSets(3);
    expect(getRemainingPlannedSetCount(targetSets, countLoggedSets(seededSets))).toBe(3);
  });

  it("reflects each set becoming logged one at a time", () => {
    const targetSets = 3;
    let sets = blankSets(3);
    expect(getRemainingPlannedSetCount(targetSets, countLoggedSets(sets))).toBe(3);

    sets = [set("80", "5"), sets[1], sets[2]];
    expect(getRemainingPlannedSetCount(targetSets, countLoggedSets(sets))).toBe(2);

    sets = [sets[0], set("80", "5"), sets[2]];
    expect(getRemainingPlannedSetCount(targetSets, countLoggedSets(sets))).toBe(1);

    sets = [sets[0], sets[1], set("80", "5")];
    expect(getRemainingPlannedSetCount(targetSets, countLoggedSets(sets))).toBeNull();

    sets = [...sets, set("80", "5")];
    expect(getRemainingPlannedSetCount(targetSets, countLoggedSets(sets))).toBeNull();
  });
});

describe("formatRemainingPlannedSets (Phase 15)", () => {
  it("returns null (nothing rendered) when there's nothing remaining", () => {
    expect(formatRemainingPlannedSets(null)).toBeNull();
  });

  it("uses singular wording for exactly 1 remaining", () => {
    expect(formatRemainingPlannedSets(1)).toBe("1 planned set not yet logged");
  });

  it("uses plural wording for more than 1 remaining", () => {
    expect(formatRemainingPlannedSets(2)).toBe("2 planned sets not yet logged");
    expect(formatRemainingPlannedSets(3)).toBe("3 planned sets not yet logged");
  });

  it("never uses fraction, percentage, or evaluative wording", () => {
    const text = formatRemainingPlannedSets(2) ?? "";
    for (const forbidden of [
      "/",
      "%",
      "completed",
      "incomplete",
      "missed",
      "skipped",
      "behind",
      "failed",
      "short",
      "adherence",
      "compliance",
      "score",
      "progress",
      "on track",
      "off track",
    ]) {
      expect(text.toLowerCase()).not.toContain(forbidden.toLowerCase());
    }
  });
});
