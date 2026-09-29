import type { DayType } from "@/lib/dayType";

// Calendar's per-day status line. "Performed" (the day has recorded sets) and "completed" (the
// user explicitly marked the workout complete) are separate facts and are worded separately —
// never collapsed into a single "logged" label. A day can be performed but not completed, or
// completed with nothing recorded.
export function formatDayStatus(day: { performed: boolean; completed: boolean }): string {
  const parts: string[] = [];
  if (day.performed) parts.push("performed");
  if (day.completed) parts.push("completed ✓");
  return parts.join(" · ");
}

export type CalendarDay = {
  title: string | null;
  performed: boolean;
  completed: boolean;
  dayType: DayType | null;
  markedLate: boolean;
};

// A planned workout on a past day with nothing recorded. Worked out, never labelled by anyone, so
// it can't be relabelled away; today isn't over, so it's never missed yet.
export function isMissedDay(day: CalendarDay, date: string, todayStr: string): boolean {
  return day.dayType === "workout" && date < todayStr && !day.performed;
}

// The two lines a calendar row shows: what was scheduled, and what happened.
export function describeCalendarDay(day: CalendarDay, date: string, todayStr: string): { plan: string; status: string } {
  const withTitle = (label: string) => (day.title ? `${label} · ${day.title}` : label);
  const plan =
    day.dayType === "rest"
      ? withTitle("😴 Rest day")
      : day.dayType === "absence"
        ? withTitle("⏸️ Absence")
        : day.dayType === "workout"
          ? (day.title ?? "Workout")
          : "Not scheduled";

  const parts = [formatDayStatus(day)].filter(Boolean);
  if (isMissedDay(day, date, todayStr)) parts.push("planned, not logged");
  if (day.dayType !== "workout" && day.dayType !== null && day.markedLate) parts.push("marked afterwards");
  return { plan, status: parts.join(" · ") };
}
