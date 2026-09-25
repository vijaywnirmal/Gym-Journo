import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import { calculateAge, daysBetween, daysSince, DATE_FMT, formatDateLong, isValidIsoDate, today, shiftDate } from "./date";

// The local calendar date, like calculateAge uses — a UTC slice is a day off for the first hours of
// the day in timezones ahead of UTC, which made these tests fail only at certain times of day.
const localDateString = (d: Date) => format(d, DATE_FMT);

describe("calculateAge", () => {
  it("computes whole years elapsed since the date of birth", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);
    const dobStr = localDateString(dob);
    expect(calculateAge(dobStr)).toBe(30);
  });

  it("does not round up before the birthday has occurred this year", () => {
    const dob = new Date();
    dob.setFullYear(dob.getFullYear() - 30);
    dob.setDate(dob.getDate() + 1); // birthday is tomorrow
    const dobStr = localDateString(dob);
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

describe("isValidIsoDate", () => {
  it("accepts real yyyy-MM-dd dates only", () => {
    expect(isValidIsoDate("2026-09-25")).toBe(true);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2026-02-31")).toBe(false);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("25/09/2026")).toBe(false);
    expect(isValidIsoDate(20260925)).toBe(false);
  });
});
