import { formatDateLong } from "@/lib/date";

export type ExerciseRecurrence = {
  count: number;
  firstDate: string;
  lastDate: string;
};

// Full-history facts over every supplied performed-session date — not a page-local count. The
// caller passes the dates of the exercise's performed sessions (see getExerciseSessions), so
// pagination can't change the result. Duplicate dates collapse to one session. ISO yyyy-MM-dd
// strings compare lexicographically for first/last. Returns null when there is nothing to report,
// so the caller can omit the section entirely.
export function summarizeExerciseRecurrence(dates: string[]): ExerciseRecurrence | null {
  if (dates.length === 0) return null;

  const unique = new Set(dates);
  let firstDate = dates[0];
  let lastDate = dates[0];
  for (const date of unique) {
    if (date < firstDate) firstDate = date;
    if (date > lastDate) lastDate = date;
  }

  return { count: unique.size, firstDate, lastDate };
}

export type ExerciseRecurrenceLines = {
  countLine: string;
  firstLine: string;
  lastLine: string;
};

// Descriptive-only wording — how many performed sessions, and the first and last dates. Nothing
// evaluative, no trend or frequency claim.
export function formatExerciseRecurrence(
  recurrence: ExerciseRecurrence | null
): ExerciseRecurrenceLines | null {
  if (recurrence === null) return null;

  const sessionWord = recurrence.count === 1 ? "session" : "sessions";
  return {
    countLine: `${recurrence.count} ${sessionWord} performed`,
    firstLine: `First performed: ${formatDateLong(recurrence.firstDate)}`,
    lastLine: `Last performed: ${formatDateLong(recurrence.lastDate)}`,
  };
}
