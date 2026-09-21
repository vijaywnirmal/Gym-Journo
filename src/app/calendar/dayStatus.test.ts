import { describe, expect, it } from "vitest";
import { formatDayStatus } from "./dayStatus";

describe("formatDayStatus", () => {
  it("shows nothing for a day with neither performed sets nor completion", () => {
    expect(formatDayStatus({ performed: false, completed: false })).toBe("");
  });

  it("20. performed without completion is worded as performed only", () => {
    expect(formatDayStatus({ performed: true, completed: false })).toBe(" · performed");
  });

  it("20. completed without any performed sets is worded as completed only", () => {
    expect(formatDayStatus({ performed: false, completed: true })).toBe(" · completed ✓");
  });

  it("shows both when the day is performed and completed", () => {
    expect(formatDayStatus({ performed: true, completed: true })).toBe(" · performed · completed ✓");
  });
});
