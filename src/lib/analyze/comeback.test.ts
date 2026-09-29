import { describe, expect, it } from "vitest";
import { comebackGapDays, lighterSetCount, lighterSets, lighterWeight } from "./comeback";

describe("comebackGapDays", () => {
  it("is the number of days since the last workout from 7 days on", () => {
    expect(comebackGapDays("2026-09-22", "2026-09-29")).toBe(7);
    expect(comebackGapDays("2026-08-30", "2026-09-29")).toBe(30);
  });

  it("is null for a shorter gap or no workout yet", () => {
    expect(comebackGapDays("2026-09-23", "2026-09-29")).toBeNull();
    expect(comebackGapDays("2026-09-29", "2026-09-29")).toBeNull();
    expect(comebackGapDays(null, "2026-09-29")).toBeNull();
  });
});

describe("lighterSetCount", () => {
  it("is about two thirds of the planned sets, never below one", () => {
    expect([1, 2, 3, 4, 5, 6].map(lighterSetCount)).toEqual([1, 1, 2, 3, 3, 4]);
    expect(lighterSetCount(0)).toBe(1);
  });
});

describe("lighterWeight", () => {
  it("is about 90%, rounded to a plate step", () => {
    expect(lighterWeight(100, "kg")).toBe(90);
    expect(lighterWeight(82.5, "kg")).toBe(75); // 74.25 -> 75
    expect(lighterWeight(225, "lb")).toBe(205); // 202.5 -> 205
  });

  it("is never heavier than the original, and never negative", () => {
    expect(lighterWeight(2.5, "kg")).toBe(2.5);
    expect(lighterWeight(0, "kg")).toBe(0);
  });

  it("rounds unknown units to 0.5", () => {
    expect(lighterWeight(33, "stone")).toBe(29.5); // 29.7 -> 29.5
  });
});

describe("lighterSets", () => {
  const set = (weight: string, weightUnit = "kg") => ({ reps: "8", weight, weightUnit });

  it("keeps about two thirds of the sets at lighter weights", () => {
    expect(lighterSets([set("100"), set("100"), set("100")])).toEqual([set("90"), set("90")]);
  });

  it("leaves blank weights blank and keeps other fields", () => {
    expect(lighterSets([set(""), set("60", "lb")])).toEqual([set("")]);
    expect(lighterSets([{ ...set("50"), reps: "12" }])).toEqual([{ ...set("45"), reps: "12" }]);
  });

  it("is empty for no sets", () => {
    expect(lighterSets([])).toEqual([]);
  });
});
