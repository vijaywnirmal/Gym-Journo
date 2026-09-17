import { formatDate } from "@/lib/date";

export type ExerciseRecurrence = {
  count: number;
  lastDate: string;
};

// Full-history recurrence over every supplied session date — not a page-local count.
// Duplicate dates (e.g. two logged_exercises rows for the same exercise on one log) collapse
// to one session, matching "a date/log containing that exercise counts as one session."
// ISO yyyy-MM-dd strings compare lexicographically for latest. Returns null when there is
// nothing to report, so the caller can omit the line entirely.
export function summarizeExerciseRecurrence(dates: string[]): ExerciseRecurrence | null {
  if (dates.length === 0) return null;

  const unique = new Set(dates);
  let lastDate = dates[0];
  for (const date of unique) {
    if (date > lastDate) lastDate = date;
  }

  return { count: unique.size, lastDate };
}

// Descriptive-only wording — full logged count and the single latest date, nothing evaluative.
export function formatExerciseRecurrence(recurrence: ExerciseRecurrence | null): string | null {
  if (recurrence === null) return null;

  const sessionWord = recurrence.count === 1 ? "session" : "sessions";
  return `${recurrence.count} ${sessionWord} logged · last on ${formatDate(recurrence.lastDate)}`;
}
