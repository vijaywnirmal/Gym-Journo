import { describe, expect, it } from "vitest";
import {
  countsTowardProgress,
  formatSetCompact,
  formatSetDetail,
  isValidRpe,
  nextSetType,
  RPE_OPTIONS,
  toSetType,
} from "./setData";

describe("set types", () => {
  it("cycles through every type and back", () => {
    expect(nextSetType("working")).toBe("warmup");
    expect(nextSetType("warmup")).toBe("drop");
    expect(nextSetType("drop")).toBe("failure");
    expect(nextSetType("failure")).toBe("working");
  });

  it("reads unknown or missing values as working", () => {
    expect(toSetType(undefined)).toBe("working");
    expect(toSetType("bogus")).toBe("working");
    expect(toSetType("drop")).toBe("drop");
  });

  it("excludes only warm-ups from progress", () => {
    expect(countsTowardProgress({ setType: "warmup" })).toBe(false);
    expect(countsTowardProgress({ setType: "failure" })).toBe(true);
    expect(countsTowardProgress({})).toBe(true);
  });
});

describe("RPE", () => {
  it("accepts 1–10 in half steps only", () => {
    expect(isValidRpe(8)).toBe(true);
    expect(isValidRpe(7.5)).toBe(true);
    expect(isValidRpe(7.3)).toBe(false);
    expect(isValidRpe(0.5)).toBe(false);
    expect(isValidRpe(10.5)).toBe(false);
    expect(isValidRpe("8")).toBe(false);
  });

  it("offers every valid option from 1 to 10", () => {
    expect(RPE_OPTIONS[0]).toBe(1);
    expect(RPE_OPTIONS[RPE_OPTIONS.length - 1]).toBe(10);
    expect(RPE_OPTIONS.every(isValidRpe)).toBe(true);
  });
});

describe("formatSetDetail / formatSetCompact", () => {
  it("is empty for a plain working set", () => {
    expect(formatSetDetail("working", null)).toBe("");
    expect(formatSetDetail(undefined, undefined)).toBe("");
  });

  it("names the type and RPE", () => {
    expect(formatSetDetail("warmup", 6)).toBe("Warm-up · RPE 6");
    expect(formatSetDetail("working", 8.5)).toBe("RPE 8.5");
  });

  it("reads numeric strings from the database as numbers", () => {
    expect(formatSetDetail("failure", "9.0" as unknown as number)).toBe("To failure · RPE 9");
  });

  it("formats compact lines with badge and RPE", () => {
    expect(formatSetCompact({ reps: 10, weight: 40, weight_unit: "kg", set_type: "warmup", rpe: 8 })).toBe("W 10×40kg @8");
    expect(formatSetCompact({ reps: 5, weight: 100, weight_unit: "kg" })).toBe("5×100kg");
  });
});
