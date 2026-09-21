import { describe, expect, it } from "vitest";
import { calculateAge, daysBetween, daysSince, formatDateLong, today, shiftDate } from "./date";

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
    expect(daysSince(today(), today())).toBe(0);
  });

  it("returns 1 for yesterday", () => {
    expect(daysSince(shiftDate(today(), -1), today())).toBe(1);
  });

  it("returns the whole-day count for an older date", () => {
    expect(daysSince(shiftDate(today(), -10), today())).toBe(10);
  });
});

describe("daysBetween", () => {
  it("counts whole calendar days between two dates", () => {
    expect(daysBetween("2026-09-11", "2026-09-18")).toBe(7);
    expect(daysBetween("2026-09-18", "2026-09-18")).toBe(0);
  });

  it("crosses month and year boundaries", () => {
    expect(daysBetween("2026-08-30", "2026-09-02")).toBe(3);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
  });
});

describe("formatDateLong", () => {
  it("includes the year", () => {
    expect(formatDateLong("2026-06-12")).toBe("Jun 12, 2026");
  });
});
