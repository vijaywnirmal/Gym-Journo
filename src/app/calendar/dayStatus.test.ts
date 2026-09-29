import { describe, expect, it } from "vitest";
import { describeCalendarDay, formatDayStatus, isMissedDay, type CalendarDay } from "./dayStatus";

describe("formatDayStatus", () => {
  it("shows nothing for a day with neither performed sets nor completion", () => {
    expect(formatDayStatus({ performed: false, completed: false })).toBe("");
  });

  it("20. performed without completion is worded as performed only", () => {
    expect(formatDayStatus({ performed: true, completed: false })).toBe("performed");
  });

  it("20. completed without any performed sets is worded as completed only", () => {
    expect(formatDayStatus({ performed: false, completed: true })).toBe("completed ✓");
  });

  it("shows both when the day is performed and completed", () => {
    expect(formatDayStatus({ performed: true, completed: true })).toBe("performed · completed ✓");
  });
});

const TODAY = "2026-09-29";
const day = (overrides: Partial<CalendarDay> = {}): CalendarDay => ({
  title: null,
  performed: false,
  completed: false,
  dayType: null,
  markedLate: false,
  ...overrides,
});

describe("isMissedDay", () => {
  it("is a planned workout on a past day with nothing performed", () => {
    expect(isMissedDay(day({ dayType: "workout" }), "2026-09-28", TODAY)).toBe(true);
  });

  it("is never today, a future day, a performed day, a day off or an unplanned day", () => {
    expect(isMissedDay(day({ dayType: "workout" }), TODAY, TODAY)).toBe(false);
    expect(isMissedDay(day({ dayType: "workout" }), "2026-09-30", TODAY)).toBe(false);
    expect(isMissedDay(day({ dayType: "workout", performed: true }), "2026-09-28", TODAY)).toBe(false);
    expect(isMissedDay(day({ dayType: "rest" }), "2026-09-28", TODAY)).toBe(false);
    expect(isMissedDay(day({ dayType: "absence" }), "2026-09-28", TODAY)).toBe(false);
    expect(isMissedDay(day(), "2026-09-28", TODAY)).toBe(false);
  });

  it("still counts as missed when the workout was only marked complete without any sets", () => {
    expect(isMissedDay(day({ dayType: "workout", completed: true }), "2026-09-28", TODAY)).toBe(true);
  });
});

describe("describeCalendarDay", () => {
  it("names what was scheduled", () => {
    expect(describeCalendarDay(day(), TODAY, TODAY).plan).toBe("Not scheduled");
    expect(describeCalendarDay(day({ dayType: "workout" }), TODAY, TODAY).plan).toBe("Workout");
    expect(describeCalendarDay(day({ dayType: "workout", title: "Push" }), TODAY, TODAY).plan).toBe("Push");
    expect(describeCalendarDay(day({ dayType: "rest" }), TODAY, TODAY).plan).toBe("😴 Rest day");
    expect(describeCalendarDay(day({ dayType: "absence", title: "Flu" }), TODAY, TODAY).plan).toBe("⏸️ Absence · Flu");
  });

  it("says a past planned workout wasn't logged", () => {
    expect(describeCalendarDay(day({ dayType: "workout", title: "Push" }), "2026-09-27", TODAY).status).toBe(
      "planned, not logged"
    );
  });

  it("notes a day off marked after the fact, and only on days off", () => {
    expect(describeCalendarDay(day({ dayType: "rest", markedLate: true }), "2026-09-27", TODAY).status).toBe(
      "marked afterwards"
    );
    expect(describeCalendarDay(day({ dayType: "absence" }), "2026-09-27", TODAY).status).toBe("");
    expect(describeCalendarDay(day({ dayType: "workout", markedLate: true, performed: true }), "2026-09-27", TODAY).status).toBe(
      "performed"
    );
  });

  it("keeps performed and completed alongside the other notes", () => {
    expect(
      describeCalendarDay(day({ dayType: "rest", markedLate: true, performed: true }), "2026-09-27", TODAY).status
    ).toBe("performed · marked afterwards");
  });
});
