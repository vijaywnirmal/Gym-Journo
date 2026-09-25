import Link from "next/link";
import { getExerciseSessions, getExercises, getLogHistory, type LogHistoryPage } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import { formatSetCompact } from "@/lib/setData";
import {
  buildSessionViews,
  pageSessionViews,
  type ExerciseSession,
} from "@/lib/analyze/exerciseSessions";
import ExerciseFilter from "./ExerciseFilter";
import { formatSessionSummary, summarizeVisibleSessions } from "./sessionSummary";
import { formatExerciseRecurrence, summarizeExerciseRecurrence } from "./exerciseRecurrence";
import { formatDaysSincePrevious, formatPerformedSet, formatSetChange } from "./exerciseHistoryFormat";

const PAGE_SIZE = 30;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; before?: string }>;
}) {
  const { exercise: exerciseId, before } = await searchParams;
  const [logPage, exercises, sessions] = await Promise.all([
    // Unfiltered History is the raw log list, unchanged. The exercise-filtered view below is built
    // from the exercise's performed sessions instead, so it never needs this query.
    exerciseId
      ? Promise.resolve<LogHistoryPage>({ logs: [], hasMore: false })
      : getLogHistory({ before, pageSize: PAGE_SIZE }),
    getExercises(),
    // Full performed history for the selected exercise — independent of this page's `before`
    // cursor, so counts/first/last/comparisons can't depend on pagination.
    exerciseId ? getExerciseSessions(exerciseId) : Promise.resolve<ExerciseSession[]>([]),
  ]);
  const { logs } = logPage;

  // Same exclusive `before` date cursor as always, applied to performed sessions. Each session was
  // compared with its real predecessor in the full history before paging, so the oldest card on a
  // page still compares against the (off-page) previous performed session.
  const exercisePage = exerciseId
    ? pageSessionViews(buildSessionViews(sessions), { before, pageSize: PAGE_SIZE })
    : null;
  const sessionViews = exercisePage?.views ?? [];
  const hasMore = exercisePage ? exercisePage.hasMore : logPage.hasMore;

  const oldestDateOnPage = exercisePage
    ? (sessionViews[sessionViews.length - 1]?.date ?? null)
    : logs.length > 0
      ? logs[logs.length - 1].date
      : null;
  const filterQuery = exerciseId ? `exercise=${exerciseId}&` : "";
  const backToRecentHref = exerciseId ? `/history?exercise=${exerciseId}` : "/history";
  // Looked up independently of the sessions so the heading still has a name when the exercise
  // has no performed sessions yet.
  const selectedExerciseName = exerciseId
    ? exercises.find((ex) => ex.id === exerciseId)?.name ?? "Exercise"
    : null;

  // Full-history facts — never shown on unfiltered History; null when nothing was performed.
  const recurrenceLines = selectedExerciseName
    ? formatExerciseRecurrence(summarizeExerciseRecurrence(sessions.map((s) => s.date)))
    : null;
  // "Shown" describes this page only. It carries no extra information while the page is the whole
  // history, so it appears only once the history is actually paged.
  const sessionSummaryText =
    selectedExerciseName && (before || hasMore)
      ? formatSessionSummary(summarizeVisibleSessions(sessionViews.map((v) => v.date)))
      : null;

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold">History</h1>

      <div className="mb-5">
        <ExerciseFilter exercises={exercises} selectedId={exerciseId} />
      </div>

      {selectedExerciseName && (
        <h2 className="mb-1 text-lg font-semibold text-neutral-100">{selectedExerciseName}</h2>
      )}

      {(recurrenceLines || sessionSummaryText) && (
        <div className="mb-3">
          {recurrenceLines && (
            <>
              <p className="text-sm text-neutral-200">{recurrenceLines.countLine}</p>
              <p className="text-xs text-neutral-500">{recurrenceLines.firstLine}</p>
              <p className="text-xs text-neutral-500">{recurrenceLines.lastLine}</p>
            </>
          )}
          {sessionSummaryText && (
            <p className="mt-1 text-xs text-neutral-500">{sessionSummaryText}</p>
          )}
        </div>
      )}

      <div className="flex flex-col gap-3 pb-4">
        {selectedExerciseName
          ? sessionViews.length === 0 && (
              <p className="text-sm text-neutral-500">
                {before
                  ? "No older performed sessions."
                  : "No performed sessions recorded for this exercise yet."}
              </p>
            )
          : logs.length === 0 && (
              <p className="text-sm text-neutral-500">
                {before ? "No older workouts." : "No workouts logged yet."}
              </p>
            )}
        {selectedExerciseName
          ? sessionViews.map((view) => {
              const gapText = formatDaysSincePrevious(view.daysSincePrevious);
              return (
                <Link
                  key={view.date}
                  href={`/log/${view.date}`}
                  className="block rounded-xl border border-neutral-800 p-4"
                >
                  <p className="font-semibold text-neutral-100">{formatDate(view.date)}</p>
                  {gapText && <p className="mb-2 text-xs text-neutral-500">{gapText}</p>}
                  <ul className={`flex flex-col gap-1 text-sm text-neutral-300 ${gapText ? "" : "mt-2"}`}>
                    {view.sets.map(({ set, comparison }) => {
                      const change = formatSetChange(comparison);
                      return (
                        <li key={set.setNumber} className="flex flex-wrap items-baseline gap-x-2">
                          <span className="w-12 text-neutral-500">Set {set.setNumber}</span>
                          <span>{formatPerformedSet(set)}</span>
                          {change && <span className="text-xs text-neutral-500">{change}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </Link>
              );
            })
          : logs.map((log) => (
              <Link
                key={log.id}
                href={`/log/${log.date}`}
                className="block rounded-xl border border-neutral-800 p-4"
              >
                <div className="mb-1 flex items-center justify-between">
                  <p className="font-semibold text-neutral-100">{formatDate(log.date)}</p>
                  {log.completed_at && <span className="text-xs text-green-400">Completed</span>}
                </div>
                <p className="mb-2 text-xs text-neutral-500">{log.planTitle ?? "Freeform workout"}</p>
                <ul className="flex flex-col gap-1 text-sm text-neutral-300">
                  {log.logged_exercises?.map((le) => (
                    <li key={le.id}>
                      <span className="font-medium text-neutral-100">{le.exercise?.name}</span>{" "}
                      <span className="text-neutral-400">
                        —{" "}
                        {le.logged_sets
                          ?.map(formatSetCompact)
                          .join(", ")}
                      </span>
                    </li>
                  ))}
                </ul>
                {log.notes && <p className="mt-2 text-xs text-neutral-500">📝 {log.notes}</p>}
              </Link>
            ))}
      </div>

      <div className="flex items-center justify-between pb-6 text-sm">
        {before ? (
          <Link href={backToRecentHref} className="text-neutral-400 underline">
            ↑ Back to most recent
          </Link>
        ) : (
          <span />
        )}
        {hasMore && oldestDateOnPage && (
          <Link
            href={`/history?${filterQuery}before=${oldestDateOnPage}`}
            className="text-neutral-400 underline"
          >
            Load older ↓
          </Link>
        )}
      </div>
    </main>
  );
}
