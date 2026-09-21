import { shiftDate, today, weekDates } from "@/lib/date";

// Workout days per calendar week. A week is Sunday–Saturday — the same week Calendar shows
// (`weekDates`). The current week is still in progress, so it is reported separately from the
// completed weeks and flagged; it is never presented as a finished week.
//
// Which dates count as workout days is decided upstream (performedWorkoutDates in
// definitions.ts); this only buckets those dates. Dates after `todayStr` are ignored regardless.

export const COMPLETED_WEEKS = 8;

export type WeeklyTrainingDays = {
  weekStart: string; // Sunday
  weekEnd: string; // Saturday
  daysPerformed: number;
  // The workout dates counted in daysPerformed (ascending) — the source records, so the count can
  // be verified.
  performedDates: string[];
  isCurrentWeek: boolean;
};

// First date to fetch: the Sunday that starts the oldest completed week shown.
export function oldestWeekStart(todayStr: string, completedWeeks: number = COMPLETED_WEEKS): string {
  return shiftDate(weekDates(todayStr)[0], -7 * completedWeeks);
}

// The current week followed by the `completedWeeks` weeks before it, newest first.
export function buildWeeklyTrainingDays(
  performedDates: ReadonlySet<string>,
  todayStr: string = today(),
  completedWeeks: number = COMPLETED_WEEKS
): WeeklyTrainingDays[] {
  const currentWeekStart = weekDates(todayStr)[0];

  return Array.from({ length: completedWeeks + 1 }, (_, i) => {
    const weekStart = shiftDate(currentWeekStart, -7 * i);
    const days = weekDates(weekStart);
    const performed = days.filter((d) => d <= todayStr && performedDates.has(d));
    return {
      weekStart,
      weekEnd: days[6],
      daysPerformed: performed.length,
      performedDates: performed,
      isCurrentWeek: i === 0,
    };
  });
}
