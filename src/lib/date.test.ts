import { describe, expect, it } from "vitest";
import { calculateAge, daysSince, today, shiftDate } from "./date";

describe("calculateAge", () => {
  it("computes whole years elapsed since the date of birth", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);
    const dobStr = dob.toISOString().slice(0, 10);
    expect(calculateAge(dobStr)).toBe(30);
  });

  it("does not round up before the birthday has occurred this year", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);
    dob.setDate(dob.getDate() + 1); // birthday is tomorrow
    const dobStr = dob.toISOString().slice(0, 10);
    expect(calculateAge(dobStr)).toBe(29);
  });
});

describe("daysSince", () => {
  it("returns 0 for today", () => {
    expect(daysSince(today())).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    expect(daysSince(shiftDate(today(), -1))).toBe(1);
  });

  it("returns the whole-day count for an older date", () => {
    expect(daysSince(shiftDate(today(), -10))).toBe(10);
  });
});
