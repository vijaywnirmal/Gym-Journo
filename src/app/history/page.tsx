import Link from "next/link";
import {
  getExerciseSessions,
  getExercises,
  getLogHistory,
  getRecentlyPerformedExerciseIds,
  type LogHistoryPage,
} from "@/lib/queries";
import PageHeader from "@/components/PageHeader";
import Icon from "@/components/Icon";
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
  const [logPage, exercises, sessions, recentIds] = await Promise.all([
    // Unfiltered History is the raw log list, unchanged. The exercise-filtered view below is built
    // from the exercise's performed sessions instead, so it never needs this query.
    exerciseId
      ? Promise.resolve<LogHistoryPage>({ logs: [], hasMore: false })
      : getLogHistory({ before, pageSize: PAGE_SIZE }),
    getExercises(),
    // Full performed history for the selected exercise — independent of this page's `before`
    // cursor, so counts/first/last/comparisons can't depend on pagination.
    exerciseId ? getExerciseSessions(exerciseId) : Promise.resolve<ExerciseSession[]>([]),
    getRecentlyPerformedExerciseIds(),
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
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader title="History" subtitle="Every workout you've logged, newest first." />

      <div className="mb-5">
        <ExerciseFilter exercises={exercises} selectedId={exerciseId} recentIds={recentIds} />
      </div>

      {selectedExerciseName && (recurrenceLines || sessionSummaryText) && (
        <section className="card mb-4 p-4">
          <h2 className="text-base font-semibold">{selectedExerciseName}</h2>
          {recurrenceLines && (
            <>
              <p className="mt-1 text-sm">{recurrenceLines.countLine}</p>
              <p className="text-xs text-label-2">
                {recurrenceLines.firstLine} · {recurrenceLines.lastLine}
              </p>
            </>
          )}
          {sessionSummaryText && <p className="mt-1 text-xs text-label-3">{sessionSummaryText}</p>}
        </section>
      )}

      <div className="flex flex-col gap-3 pb-4">
        {selectedExerciseName
          ? sessionViews.length === 0 && (
              <EmptyState
                title={before ? "No older sessions" : "No sessions yet"}
                text={before ? "That's everything for this exercise." : "You haven't logged this exercise yet."}
              />
            )
          : logs.length === 0 && (
              <EmptyState
                title={before ? "No older workouts" : "No workouts yet"}
                text={before ? "You've reached your first workout." : "Workouts you log will show up here."}
              />
            )}
        {selectedExerciseName
          ? sessionViews.map((view) => {
              const gapText = formatDaysSincePrevious(view.daysSincePrevious);
              return (
                <Link key={view.date} href={`/log/${view.date}`} className="card block p-4 hover:bg-fill">
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <p className="font-semibold">{formatDate(view.date)}</p>
                    {gapText && <p className="text-xs text-label-3">{gapText}</p>}
                  </div>
                  <ul className="flex flex-col gap-1 text-sm">
                    {view.sets.map(({ set, comparison }) => {
                      const change = formatSetChange(comparison);
                      return (
                        <li key={set.setNumber} className="flex flex-wrap items-baseline gap-x-3">
                          <span className="w-10 text-xs text-label-3">Set {set.setNumber}</span>
                          <span className="tabular-nums">{formatPerformedSet(set)}</span>
                          {change && <span className="text-xs text-label-2">{change}</span>}
                        </li>
                      );
                    })}
                  </ul>
                </Link>
              );
            })
          : logs.map((log) => (
              <Link key={log.id} href={`/log/${log.date}`} className="card block p-4 hover:bg-fill">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{formatDate(log.date)}</p>
                    <p className="truncate text-sm text-label-2">{log.planTitle ?? "Freeform workout"}</p>
                  </div>
                  {log.completed_at && (
                    <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-green">
                      <Icon name="checkmark" className="size-3.5" strokeWidth={2.5} />
                      Completed
                    </span>
                  )}
                </div>
                {log.logged_exercises && log.logged_exercises.length > 0 && (
                  <ul className="mt-3 flex flex-col gap-1.5 border-t border-separator pt-3 text-sm">
                    {log.logged_exercises.map((le) => (
                      <li key={le.id} className="flex gap-3">
                        <span className="min-w-0 flex-1 truncate font-medium">{le.exercise?.name}</span>
                        <span className="shrink-0 text-right text-xs leading-5 tabular-nums text-label-2">
                          {le.logged_sets?.map(formatSetCompact).join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
                {log.notes && <p className="mt-2 text-xs text-label-2 italic">{log.notes}</p>}
              </Link>
            ))}
      </div>

      <div className="flex items-center justify-between gap-2 pb-6">
        {before ? (
          <Link
            href={backToRecentHref}
            className="flex h-9 items-center rounded-[10px] px-3 text-sm font-medium text-link hover:bg-fill"
          >
            Back to most recent
          </Link>
        ) : (
          <span />
        )}
        {hasMore && oldestDateOnPage && (
          <Link
            href={`/history?${filterQuery}before=${oldestDateOnPage}`}
            className="flex h-9 items-center rounded-[10px] border border-separator px-3 text-sm font-medium hover:bg-fill"
          >
            Older workouts
          </Link>
        )}
      </div>
    </main>
  );
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <section className="card px-6 py-10 text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-label-2">{text}</p>
    </section>
  );
}
