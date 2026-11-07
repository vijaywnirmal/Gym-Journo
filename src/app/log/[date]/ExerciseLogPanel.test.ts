import { describe, expect, it } from "vitest";
import {
  plateText,
  setsFromPrevious,
  compareSets,
  countLoggedSets,
  exerciseHistoryHref,
  formatRemainingPlannedSets,
  formatSetComparison,
  getRemainingPlannedSetCount,
  setCountLabel,
  setValueProblem,
  firstEntryWithSetProblem,
  setHasValues,
  toSavedSet,
  type SetRow,
} from "./ExerciseLogPanel";
import type { PreviousPerformance } from "@/lib/queries";

function set(weight: string, reps: string, weightUnit = "kg"): SetRow {
  return { weight, reps, weightUnit, setType: "working", rpe: "", duration: "", distance: "", distanceUnit: "km" };
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

describe("setsFromPrevious (M3)", () => {
  it("returns nothing when there is no previous session", () => {
    expect(setsFromPrevious(null)).toEqual([]);
    expect(setsFromPrevious(undefined)).toEqual([]);
  });

  it("copies sets in set order, keeping units and leaving missing values blank", () => {
    const previous: PreviousPerformance = {
      date: "2026-09-01",
      sets: [
        { setNumber: 2, reps: 8, weight: null, weightUnit: "lb" },
        { setNumber: 1, reps: 10, weight: 60, weightUnit: "kg" },
      ],
    };
    expect(setsFromPrevious(previous)).toEqual([
      { reps: "10", weight: "60", weightUnit: "kg", setType: "working", rpe: "", duration: "", distance: "", distanceUnit: "km" },
      { reps: "8", weight: "", weightUnit: "lb", setType: "working", rpe: "", duration: "", distance: "", distanceUnit: "km" },
    ]);
  });

  it("keeps a recorded 0 rather than blanking it", () => {
    const previous: PreviousPerformance = {
      date: "2026-09-01",
      sets: [{ setNumber: 1, reps: 10, weight: 0, weightUnit: "kg" }],
    };
    expect(setsFromPrevious(previous)[0].weight).toBe("0");
  });
});

describe("timed and distance rows (I1.2, I1.3)", () => {
  const row = (overrides: Partial<SetRow>): SetRow => ({ ...set("", ""), ...overrides });

  it("counts a row with only a time or a distance as logged", () => {
    expect(setHasValues(row({ duration: "1:30" }))).toBe(true);
    expect(setHasValues(row({ distance: "5" }))).toBe(true);
    expect(setHasValues(row({}))).toBe(false);
    expect(countLoggedSets([row({ duration: "45" }), row({})])).toBe(1);
  });

  it("saves times as seconds, distances as numbers, and blanks as null", () => {
    expect(toSavedSet(row({ duration: "1:30" }))).toMatchObject({ durationSeconds: 90, distance: null, reps: null, weight: null });
    expect(toSavedSet(row({ distance: "5.2", duration: "28:30", distanceUnit: "mi" }))).toMatchObject({
      distance: 5.2,
      durationSeconds: 1710,
      distanceUnit: "mi",
    });
    // A time that can't be read isn't saved; the row says why.
    expect(toSavedSet(row({ duration: "1.5" })).durationSeconds).toBeNull();
    expect(setValueProblem(row({ duration: "1.5" }))).toMatch(/like 45/);
  });

  it("explains times and distances it can't save", () => {
    expect(setValueProblem(row({ duration: "3:00:00" }))).toMatch(/2 hours or less/);
    expect(setValueProblem(row({ distance: "2000" }))).toMatch(/between 0 and 1000/);
    expect(setValueProblem(row({ duration: "45", distance: "1" }))).toBeNull();
  });

  it("copies last time's time and distance for Repeat", () => {
    const rows = setsFromPrevious({
      date: "2026-10-01",
      sets: [{ setNumber: 1, reps: null, weight: null, weightUnit: "kg", durationSeconds: 1710, distance: 5, distanceUnit: "mi" }],
    });
    expect(rows[0]).toMatchObject({ duration: "28:30", distance: "5", distanceUnit: "mi", reps: "", weight: "" });
  });
});

describe("plateText (M3)", () => {
  it("describes the per-side load", () => {
    expect(plateText({ reps: "5", weight: "100", weightUnit: "kg", setType: "working", rpe: "", duration: "", distance: "", distanceUnit: "km" })).toBe("Per side: 25 + 15");
    expect(plateText({ reps: "5", weight: "225", weightUnit: "lb", setType: "working", rpe: "", duration: "", distance: "", distanceUnit: "km" })).toBe("Per side: 45 ×2");
  });

  it("notes when the weight can't be made exactly", () => {
    expect(plateText({ reps: "5", weight: "101", weightUnit: "kg", setType: "working", rpe: "", duration: "", distance: "", distanceUnit: "km" })).toBe(
      "Per side: 25 + 15 (100 kg loaded, 1 short)"
    );
  });

  it("says nothing for blank weights or loads at or below the bar", () => {
    expect(plateText({ reps: "5", weight: "", weightUnit: "kg", setType: "working", rpe: "", duration: "", distance: "", distanceUnit: "km" })).toBeNull();
    expect(plateText({ reps: "5", weight: "20", weightUnit: "kg", setType: "working", rpe: "", duration: "", distance: "", distanceUnit: "km" })).toBeNull();
    expect(plateText({ reps: "5", weight: "21", weightUnit: "kg", setType: "working", rpe: "", duration: "", distance: "", distanceUnit: "km" })).toBeNull();
  });

  it("doesn't compare a working set with last time's warm-up in the same position", () => {
    const previous: PreviousPerformance = {
      date: "2026-09-10",
      sets: [
        { setNumber: 1, weight: 40, reps: 10, weightUnit: "kg", setType: "warmup" },
        { setNumber: 2, weight: 80, reps: 5, weightUnit: "kg", setType: "working" },
      ],
    };
    const [first, second] = compareSets([{ ...set("80", "5"), setType: "working" }, { ...set("80", "5"), setType: "working" }], previous);
    expect(first).toBeNull();
    expect(formatSetComparison(second)).toBe("same weight as last time · same reps as last time");
  });
});

describe("firstEntryWithSetProblem", () => {
  const good = { sets: [{ weight: "60", reps: "8" }] };
  const bad = { sets: [{ weight: "60", reps: "8" }, { weight: "2000", reps: "8" }] };

  it("finds the first exercise with a number that can't save", () => {
    expect(firstEntryWithSetProblem([good, bad, bad])).toBe(1);
  });

  it("says so when every number is fine", () => {
    expect(firstEntryWithSetProblem([good, good])).toBe(-1);
    expect(firstEntryWithSetProblem([])).toBe(-1);
  });
});

describe("setValueProblem", () => {
  it("accepts blank and in-range numbers", () => {
    expect(setValueProblem({ weight: "", reps: "" })).toBeNull();
    expect(setValueProblem({ weight: "0", reps: "0" })).toBeNull();
    expect(setValueProblem({ weight: "1000", reps: "1000" })).toBeNull();
    expect(setValueProblem({ weight: "52.5", reps: "8" })).toBeNull();
  });

  it("names the number the server would refuse", () => {
    expect(setValueProblem({ weight: "-5", reps: "8" })).toContain("weight");
    expect(setValueProblem({ weight: "1000.5", reps: "8" })).toContain("weight");
    expect(setValueProblem({ weight: "60", reps: "-1" })).toContain("reps");
    expect(setValueProblem({ weight: "60", reps: "1001" })).toContain("reps");
  });
});

describe("setCountLabel", () => {
  it("says 1 set, not 1 sets", () => {
    expect(setCountLabel(1)).toBe("1 set");
    expect(setCountLabel(3)).toBe("3 sets");
  });
});
