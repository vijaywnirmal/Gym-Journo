import { describe, expect, it } from "vitest";
import { formatWeightKg, formatDeltaKg, formatLastWorkout } from "./BodyProgressSummary";
import { today, shiftDate } from "@/lib/date";

describe("formatWeightKg", () => {
  it("formats to one decimal place", () => {
    expect(formatWeightKg(80)).toBe("80.0 kg");
    expect(formatWeightKg(78.5)).toBe("78.5 kg");
  });
});

describe("formatDeltaKg", () => {
  it("formats a decrease with a minus sign", () => {
    expect(formatDeltaKg(-1.5)).toBe("−1.5 kg");
  });

  it("formats an increase with a plus sign", () => {
    expect(formatDeltaKg(1.5)).toBe("+1.5 kg");
  });

  it("formats no change with no sign", () => {
    expect(formatDeltaKg(0)).toBe("0.0 kg");
  });
});

describe("formatLastWorkout", () => {
  it("shows a neutral empty state when no workout has ever been logged", () => {
    expect(formatLastWorkout(null, today())).toBe("No workouts logged yet.");
  });

  it("shows 'today' when the last workout was logged today", () => {
    expect(formatLastWorkout(today(), today())).toBe("Last workout: today.");
  });

  it("shows 'yesterday' when the last workout was logged yesterday", () => {
    expect(formatLastWorkout(shiftDate(today(), -1), today())).toBe("Last workout: yesterday.");
  });

  it("shows a day count for an older workout", () => {
    expect(formatLastWorkout(shiftDate(today(), -5), today())).toBe("Last workout: 5 days ago.");
  });

  it("uses canonical local date semantics, not UTC arithmetic, at the day boundary", () => {
    expect(formatLastWorkout(shiftDate(today(), -28), today())).toBe("Last workout: 28 days ago.");
  });
});
