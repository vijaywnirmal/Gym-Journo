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
    return {
      weekStart,
      weekEnd: days[6],
      daysPerformed: days.filter((d) => d <= todayStr && performedDates.has(d)).length,
      isCurrentWeek: i === 0,
    };
  });
}
