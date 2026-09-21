import { describe, expect, it } from "vitest";
import { formatDaysSincePrevious, formatPerformedSet, formatSetChange } from "./exerciseHistoryFormat";
import { formatExerciseRecurrence } from "./exerciseRecurrence";

describe("formatPerformedSet", () => {
  it("renders weight, unit and reps", () => {
    expect(formatPerformedSet({ setNumber: 1, reps: 8, weight: 80, weightUnit: "kg" })).toBe("80kg × 8");
  });

  it("keeps a missing value as ? instead of inventing one, and shows real zeros", () => {
    expect(formatPerformedSet({ setNumber: 1, reps: 12, weight: null, weightUnit: "kg" })).toBe("?kg × 12");
    expect(formatPerformedSet({ setNumber: 1, reps: null, weight: 20, weightUnit: "lb" })).toBe("20lb × ?");
    expect(formatPerformedSet({ setNumber: 1, reps: 0, weight: 0, weightUnit: "kg" })).toBe("0kg × 0");
  });
});

describe("formatSetChange", () => {
  it("shows signed differences", () => {
    expect(
      formatSetChange({ weight: { type: "delta", delta: -5, unit: "kg" }, reps: { type: "delta", delta: 2 } })
    ).toBe("−5 kg · +2 reps");
  });

  it("uses singular 'rep' for a single-rep difference", () => {
    expect(formatSetChange({ weight: { type: "unavailable" }, reps: { type: "delta", delta: 1 } })).toBe("+1 rep");
    expect(formatSetChange({ weight: { type: "unavailable" }, reps: { type: "delta", delta: -1 } })).toBe("−1 rep");
  });

  it("states 'same' plainly", () => {
    expect(formatSetChange({ weight: { type: "same" }, reps: { type: "same" } })).toBe("same weight · same reps");
    expect(formatSetChange({ weight: { type: "same" }, reps: { type: "delta", delta: 2 } })).toBe("same weight · +2 reps");
  });

  it("omits a value that can't be compared, and returns null when nothing can", () => {
    expect(formatSetChange({ weight: { type: "unavailable" }, reps: { type: "same" } })).toBe("same reps");
    expect(formatSetChange({ weight: { type: "unavailable" }, reps: { type: "unavailable" } })).toBeNull();
    expect(formatSetChange(null)).toBeNull();
  });

  it("rounds floating-point noise out of the displayed difference", () => {
    expect(
      formatSetChange({
        weight: { type: "delta", delta: 0.30000000000000004, unit: "kg" },
        reps: { type: "unavailable" },
      })
    ).toBe("+0.3 kg");
  });
});

describe("formatDaysSincePrevious", () => {
  it("returns null when there is no previous session", () => {
    expect(formatDaysSincePrevious(null)).toBeNull();
  });

  it("states the gap factually, singular and plural", () => {
    expect(formatDaysSincePrevious(1)).toBe("1 day since previous performed session");
    expect(formatDaysSincePrevious(7)).toBe("7 days since previous performed session");
  });
});

describe("exercise History wording stays descriptive", () => {
  it("contains no evaluative, trend, or coaching language", () => {
    const texts = [
      formatSetChange({ weight: { type: "delta", delta: 2.5, unit: "kg" }, reps: { type: "delta", delta: -1 } }),
      formatSetChange({ weight: { type: "same" }, reps: { type: "same" } }),
      formatDaysSincePrevious(7),
      ...Object.values(
        formatExerciseRecurrence({ count: 12, firstDate: "2026-06-12", lastDate: "2026-09-18" }) ?? {}
      ),
    ]
      .join(" ")
      .toLowerCase();
    for (const forbidden of [
      "progress",
      "improv",
      "stronger",
      "declin",
      "regress",
      "plateau",
      "great",
      "should",
      "recommend",
      "optimal",
      "recovery",
      "gain",
      "better",
      "worse",
      "pr ",
    ]) {
      expect(texts).not.toContain(forbidden);
    }
  });
});
