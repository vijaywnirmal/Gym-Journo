import { format, parseISO } from "date-fns";
import type { WeeklyTrainingDays } from "@/lib/analyze/weeklyTraining";

// Purely factual wording for the weekly training-days list: how many workout days were performed,
// the stated weekly target, and the arithmetic difference. No judgment of any kind.

export function formatDayCount(days: number): string {
  return `${days} day${days === 1 ? "" : "s"}`;
}

// "Sep 13–19", "Aug 30–Sep 5", or with years when the week spans a year boundary.
export function formatWeekRange(weekStart: string, weekEnd: string): string {
  const start = parseISO(weekStart);
  const end = parseISO(weekEnd);
  if (start.getFullYear() !== end.getFullYear()) {
    return `${format(start, "MMM d, yyyy")}–${format(end, "MMM d, yyyy")}`;
  }
  if (start.getMonth() !== end.getMonth()) {
    return `${format(start, "MMM d")}–${format(end, "MMM d")}`;
  }
  return `${format(start, "MMM d")}–${format(end, "d")}`;
}

// performed − target, signed. Zero carries no sign.
export function formatDifference(performed: number, target: number): string {
  const diff = performed - target;
  if (diff === 0) return "0 days";
  return `${diff > 0 ? "+" : "−"}${formatDayCount(Math.abs(diff))}`;
}

export type WeeklyTrainingRow = {
  key: string;
  label: string;
  inProgress: boolean;
  performedLine: string;
  targetLine: string | null;
  // Null for the in-progress week (a partial week has no meaningful difference) and when no
  // weekly target is set.
  differenceLine: string | null;
};

export function buildWeeklyTrainingRows(
  weeks: WeeklyTrainingDays[],
  target: number | null
): WeeklyTrainingRow[] {
  return weeks.map((week) => ({
    key: week.weekStart,
    label: `Week of ${formatWeekRange(week.weekStart, week.weekEnd)}`,
    inProgress: week.isCurrentWeek,
    performedLine: `Performed: ${formatDayCount(week.daysPerformed)}`,
    targetLine: target === null ? null : `Target: ${formatDayCount(target)}`,
    differenceLine:
      target === null || week.isCurrentWeek
        ? null
        : `Difference: ${formatDifference(week.daysPerformed, target)}`,
  }));
}
