import { describe, expect, it } from "vitest";
import { compareReps, compareSet, compareWeight } from "./setComparison";

describe("compareWeight", () => {
  it("reports the arithmetic difference in the shared unit", () => {
    expect(compareWeight(82.5, "kg", 80, "kg")).toEqual({ type: "delta", delta: 2.5, unit: "kg" });
    expect(compareWeight(75, "kg", 80, "kg")).toEqual({ type: "delta", delta: -5, unit: "kg" });
  });

  it("reports same when the values are equal", () => {
    expect(compareWeight(80, "kg", 80, "kg")).toEqual({ type: "same" });
  });

  it("19. mixed units are unavailable — never converted", () => {
    expect(compareWeight(176, "lb", 80, "kg")).toEqual({ type: "unavailable" });
  });

  it("is unavailable when either weight is missing", () => {
    expect(compareWeight(null, "kg", 80, "kg")).toEqual({ type: "unavailable" });
    expect(compareWeight(80, "kg", null, "kg")).toEqual({ type: "unavailable" });
  });

  it("8. a zero weight is a real value, not missing", () => {
    expect(compareWeight(0, "kg", 10, "kg")).toEqual({ type: "delta", delta: -10, unit: "kg" });
  });
});

describe("compareReps", () => {
  it("reports delta, same, and unavailable", () => {
    expect(compareReps(10, 8)).toEqual({ type: "delta", delta: 2 });
    expect(compareReps(8, 8)).toEqual({ type: "same" });
    expect(compareReps(null, 8)).toEqual({ type: "unavailable" });
    expect(compareReps(8, null)).toEqual({ type: "unavailable" });
  });

  it("8. zero reps is a real value", () => {
    expect(compareReps(0, 5)).toEqual({ type: "delta", delta: -5 });
  });
});

describe("compareSet", () => {
  it("evaluates weight and reps independently — a unit mismatch doesn't suppress the reps comparison", () => {
    const result = compareSet(
      { reps: 8, weight: 176, weightUnit: "lb" },
      { reps: 6, weight: 80, weightUnit: "kg" }
    );
    expect(result.weight).toEqual({ type: "unavailable" });
    expect(result.reps).toEqual({ type: "delta", delta: 2 });
  });
});
