import { formatDate } from "@/lib/date";
import { isPerformedExerciseSession, type ExerciseSessionLike } from "@/lib/analyze/definitions";

export type SessionSummary = {
  count: number;
  earliestDate: string;
  latestDate: string;
};

// Purely descriptive orientation over whatever session dates are currently loaded — never a
// lifetime total. `dates` is exactly the set of dates already fetched for the active page (see
// history/page.tsx), so under "Load older" pagination this only ever describes what's on screen,
// order-independent (ISO yyyy-MM-dd strings compare correctly lexicographically for min/max).
// Returns null when there's nothing to summarize, so the caller can render no line at all.
export function summarizeVisibleSessions(dates: string[]): SessionSummary | null {
  if (dates.length === 0) return null;

  let earliestDate = dates[0];
  let latestDate = dates[0];
  for (const date of dates) {
    if (date < earliestDate) earliestDate = date;
    if (date > latestDate) latestDate = date;
  }

  return { count: dates.length, earliestDate, latestDate };
}

// The page-local session summary for one selected exercise. "Shown" still means "this page", but
// what counts as a session is the canonical performed-session definition shared with the
// full-history recurrence (isPerformedExerciseSession): blank-only and future-dated logs don't
// count, and the date range is derived from that same performed population. Dates are
// de-duplicated so a session is counted once however many occurrences it has. Returns null when
// no performed session is on the page, so no line is rendered.
export function summarizePerformedSessions(
  logs: ExerciseSessionLike[],
  exerciseId: string,
  todayStr?: string
): SessionSummary | null {
  const dates = new Set(
    logs.filter((log) => isPerformedExerciseSession(log, exerciseId, todayStr)).map((log) => log.date)
  );
  return summarizeVisibleSessions([...dates]);
}

// Descriptive-only wording — count and the visible date range, nothing evaluative. A single
// session collapses the range to one date instead of repeating it.
export function formatSessionSummary(summary: SessionSummary | null): string | null {
  if (summary === null) return null;

  const sessionWord = summary.count === 1 ? "session" : "sessions";
  const range =
    summary.earliestDate === summary.latestDate
      ? formatDate(summary.earliestDate)
      : `${formatDate(summary.earliestDate)} – ${formatDate(summary.latestDate)}`;

  return `${summary.count} ${sessionWord} shown · ${range}`;
}
