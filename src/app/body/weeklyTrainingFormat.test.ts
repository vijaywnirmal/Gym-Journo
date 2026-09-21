import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  buildWeeklyTrainingRows,
  formatDayCount,
  formatDifference,
  formatWeekRange,
} from "./weeklyTrainingFormat";
import WeeklyTrainingDays from "./WeeklyTrainingDays";
import type { WeeklyTrainingDays as Week } from "@/lib/analyze/weeklyTraining";

const week = (weekStart: string, weekEnd: string, daysPerformed: number, isCurrentWeek = false): Week => ({
  weekStart,
  weekEnd,
  daysPerformed,
  performedDates: [],
  isCurrentWeek,
});

describe("formatWeekRange", () => {
  it("same month: Sep 13–19", () => {
    expect(formatWeekRange("2026-09-13", "2026-09-19")).toBe("Sep 13–19");
  });

  it("7. across a month boundary: Aug 30–Sep 5", () => {
    expect(formatWeekRange("2026-08-30", "2026-09-05")).toBe("Aug 30–Sep 5");
  });

  it("8. across a year boundary the years are shown", () => {
    expect(formatWeekRange("2025-12-28", "2026-01-03")).toBe("Dec 28, 2025–Jan 3, 2026");
  });
});

describe("formatDayCount / formatDifference", () => {
  it("pluralizes days", () => {
    expect(formatDayCount(1)).toBe("1 day");
    expect(formatDayCount(0)).toBe("0 days");
    expect(formatDayCount(4)).toBe("4 days");
  });

  it("11. a positive difference is signed +", () => {
    expect(formatDifference(5, 4)).toBe("+1 day");
    expect(formatDifference(6, 4)).toBe("+2 days");
  });

  it("12. a zero difference carries no sign", () => {
    expect(formatDifference(4, 4)).toBe("0 days");
  });

  it("13. a negative difference uses the minus sign", () => {
    expect(formatDifference(3, 4)).toBe("−1 day");
    expect(formatDifference(0, 4)).toBe("−4 days");
  });
});

describe("buildWeeklyTrainingRows", () => {
  const weeks = [
    week("2026-09-20", "2026-09-26", 1, true),
    week("2026-09-13", "2026-09-19", 3),
    week("2026-09-06", "2026-09-12", 4),
    week("2026-08-30", "2026-09-05", 5),
  ];

  it("10. shows the user's stated target on every row", () => {
    for (const row of buildWeeklyTrainingRows(weeks, 4)) {
      expect(row.targetLine).toBe("Target: 4 days");
    }
    expect(buildWeeklyTrainingRows(weeks, 1)[1].targetLine).toBe("Target: 1 day");
  });

  it("states performed days, target and difference for completed weeks (negative, zero, positive)", () => {
    const rows = buildWeeklyTrainingRows(weeks, 4);
    expect(rows[1]).toMatchObject({
      label: "Week of Sep 13–19",
      performedLine: "Performed: 3 days",
      differenceLine: "Difference: −1 day",
    });
    expect(rows[2]).toMatchObject({ performedLine: "Performed: 4 days", differenceLine: "Difference: 0 days" });
    expect(rows[3]).toMatchObject({
      label: "Week of Aug 30–Sep 5",
      performedLine: "Performed: 5 days",
      differenceLine: "Difference: +1 day",
    });
  });

  it("14. the in-progress week is flagged and shows no difference", () => {
    const [current] = buildWeeklyTrainingRows(weeks, 4);
    expect(current.inProgress).toBe(true);
    expect(current.performedLine).toBe("Performed: 1 day");
    expect(current.targetLine).toBe("Target: 4 days");
    expect(current.differenceLine).toBeNull();
    expect(buildWeeklyTrainingRows(weeks, 4).slice(1).every((r) => !r.inProgress)).toBe(true);
  });

  it("9. a week with no activity reads Performed: 0 days", () => {
    const [row] = buildWeeklyTrainingRows([week("2026-09-06", "2026-09-12", 0)], 4);
    expect(row.performedLine).toBe("Performed: 0 days");
    expect(row.differenceLine).toBe("Difference: −4 days");
  });

  it("with no stated target, shows performed days only — no target or difference", () => {
    for (const row of buildWeeklyTrainingRows(weeks, null)) {
      expect(row.targetLine).toBeNull();
      expect(row.differenceLine).toBeNull();
      expect(row.performedLine).toMatch(/^Performed: \d+ days?$/);
    }
  });
});

describe("WeeklyTrainingDays component", () => {
  const html = (target: number | null) =>
    renderToStaticMarkup(
      createElement(WeeklyTrainingDays, {
        targetDaysPerWeek: target,
        weeks: [
          week("2026-09-20", "2026-09-26", 1, true),
          week("2026-09-13", "2026-09-19", 3),
          week("2026-09-06", "2026-09-12", 4),
        ],
      })
    );

  it("renders the factual weekly lines", () => {
    const out = html(4);
    expect(out).toContain("Weekly training days");
    expect(out).toContain("Week of Sep 20–26 · in progress");
    expect(out).toContain("Performed: 1 day · Target: 4 days");
    expect(out).toContain("Week of Sep 13–19");
    expect(out).toContain("Performed: 3 days · Target: 4 days · Difference: −1 day");
    expect(out).toContain("Performed: 4 days · Target: 4 days · Difference: 0 days");
  });

  it("without a target it lists performed days only", () => {
    const out = html(null);
    expect(out).toContain("Performed: 3 days");
    expect(out).not.toContain("Target");
    expect(out).not.toContain("Difference");
  });

  it("never uses evaluative, adherence or coaching language", () => {
    const text = (html(4) + html(null)).replace(/<[^>]+>/g, " ").toLowerCase();
    for (const forbidden of [
      "missed",
      "behind",
      "consisten",
      "improv",
      "falling",
      "should",
      "on track",
      "off track",
      "adheren",
      "good",
      "poor",
      "great",
      "goal met",
      "success",
      "fail",
    ]) {
      expect(text).not.toContain(forbidden);
    }
  });
});
