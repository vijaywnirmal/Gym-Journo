import { formatDate } from "@/lib/date";

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
