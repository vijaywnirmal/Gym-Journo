import { describe, expect, it } from "vitest";
import { calculatePlates, formatPlates, isPlateUnit } from "./plates";

describe("calculatePlates", () => {
  it("loads kg plates per side, heaviest first", () => {
    expect(calculatePlates(100, "kg")).toEqual({ perSide: [25, 15], loaded: 100, remainder: 0 });
  });

  it("handles fractional plates without float error", () => {
    expect(calculatePlates(62.5, "kg")).toEqual({ perSide: [20, 1.25], loaded: 62.5, remainder: 0 });
    expect(calculatePlates(22.5, "kg")).toEqual({ perSide: [1.25], loaded: 22.5, remainder: 0 });
  });

  it("uses a 45 lb bar and lb plates", () => {
    expect(calculatePlates(225, "lb")).toEqual({ perSide: [45, 45], loaded: 225, remainder: 0 });
    expect(calculatePlates(185, "lb")).toEqual({ perSide: [45, 25], loaded: 185, remainder: 0 });
  });

  it("reports the leftover when the target can't be made exactly", () => {
    expect(calculatePlates(101, "kg")).toEqual({ perSide: [25, 15], loaded: 100, remainder: 1 });
  });

  it("returns null at or below the bar, or for invalid input", () => {
    expect(calculatePlates(20, "kg")).toBeNull();
    expect(calculatePlates(10, "kg")).toBeNull();
    expect(calculatePlates(Number.NaN, "kg")).toBeNull();
  });

  it("accepts a custom bar and plate set", () => {
    expect(calculatePlates(50, "kg", 15, [10, 5])).toEqual({
      perSide: [10, 5],
      loaded: 45,
      remainder: 5,
    });
  });
});

describe("formatPlates", () => {
  it("groups repeated plates", () => {
    expect(formatPlates([25, 25, 5, 1.25])).toBe("25 ×2 + 5 + 1.25");
    expect(formatPlates([20])).toBe("20");
  });
});

describe("isPlateUnit", () => {
  it("accepts kg and lb only", () => {
    expect(isPlateUnit("kg")).toBe(true);
    expect(isPlateUnit("lb")).toBe(true);
    expect(isPlateUnit("st")).toBe(false);
  });
});
