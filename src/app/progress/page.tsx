import type { Metadata } from "next";
import Link from "next/link";
import { getExerciseFilterOptions, getExerciseSessions } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import {
  bestEstimatedOneRepMax,
  buildProgressPoints,
  heaviestSet,
} from "@/lib/analyze/progress";
import {
  bestSessionVolume,
  buildRecordHistory,
  describePersonalRecord,
} from "@/lib/analyze/personalRecords";
import ExerciseFilter from "@/app/history/ExerciseFilter";
import TrendChart from "@/components/TrendChart";
import PageHeader from "@/components/PageHeader";
import Icon from "@/components/Icon";
import { requireMemberApp } from "@/lib/workAccount";

export const metadata: Metadata = { title: "Progress" };

function round1(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs font-medium text-label-2">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums tracking-tight">{value}</p>
      {detail && <p className="text-xs text-label-3">{detail}</p>}
    </div>
  );
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  await requireMemberApp();
  const { exercise: exerciseId } = await searchParams;
  const [exercises, sessions] = await Promise.all([
    getExerciseFilterOptions(exerciseId),
    exerciseId ? getExerciseSessions(exerciseId) : Promise.resolve([]),
  ]);

  const selectedExerciseName = exerciseId
    ? exercises.find((ex) => ex.id === exerciseId)?.name ?? "Exercise"
    : null;

  const points = buildProgressPoints(sessions);
  const pr = heaviestSet(sessions);
  const e1rm = bestEstimatedOneRepMax(sessions);
  const bestVolume = bestSessionVolume(sessions);
  const recordHistory = buildRecordHistory(sessions);
  const recordCount = recordHistory.reduce((n, e) => n + e.records.length, 0);

  return (
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <PageHeader title="Progress" subtitle="Strength and volume trends for one exercise at a time." />

      <div className="mb-6">
        <ExerciseFilter
          exercises={exercises}
          selectedId={exerciseId}
          basePath="/progress"
          allLabel="Choose an exercise"
        />
      </div>

      {!exerciseId &&
        (exercises.length > 0 ? (
          <>
            <h2 className="section-title">Exercises you&apos;ve logged</h2>
            <ul className="card mb-6 divide-y divide-separator overflow-hidden">
              {exercises.map((ex) => (
                <li key={ex.id}>
                  <Link href={`/progress?exercise=${ex.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fill">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{ex.name}</span>
                    <Icon name="chevronRight" className="size-4 text-label-3" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <section className="card px-6 py-10 text-center">
            <h2 className="text-base font-semibold">No progress to show yet</h2>
            <p className="mt-1 text-sm text-label-2">Log a few workouts and your trends will appear here.</p>
          </section>
        ))}

      {exerciseId && sessions.length === 0 && (
        <section className="card px-6 py-10 text-center">
          <h2 className="text-base font-semibold">No sessions yet</h2>
          <p className="mt-1 text-sm text-label-2">You haven&apos;t logged {selectedExerciseName} yet.</p>
        </section>
      )}

      {exerciseId && sessions.length > 0 && (
        <div className="flex flex-col gap-6 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <Stat
              label="Heaviest set"
              value={pr ? `${round1(pr.weightKg)} kg × ${pr.reps}` : "—"}
              detail={pr ? formatDate(pr.date) : undefined}
            />
            <Stat
              label="Best est. 1RM"
              value={e1rm ? `${round1(e1rm.e1rmKg)} kg` : "—"}
              detail={e1rm ? formatDate(e1rm.date) : undefined}
            />
            <Stat
              label="Best session volume"
              value={bestVolume ? `${Math.round(bestVolume.volumeKg).toLocaleString("en-US")} kg` : "—"}
              detail={bestVolume ? formatDate(bestVolume.date) : undefined}
            />
            <Stat
              label="Personal records"
              value={String(recordCount)}
              detail={`across ${sessions.length} session${sessions.length === 1 ? "" : "s"}`}
            />
          </div>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">Estimated 1RM</h2>
            <TrendChart
              points={points
                .filter((p) => p.e1rmKg !== null)
                .map((p) => ({ date: p.date, value: p.e1rmKg as number }))}
              unit="kg"
            />
          </section>

          <section className="card p-4">
            <h2 className="mb-3 text-sm font-semibold">Volume per session</h2>
            <TrendChart points={points.map((p) => ({ date: p.date, value: p.volumeKg }))} unit="kg" />
          </section>

          <section>
            <h2 className="section-title">Record history</h2>
            {recordHistory.length === 0 ? (
              <p className="text-sm text-label-2">
                {sessions.length === 1
                  ? "Records start from your second session — the first one sets the bar."
                  : "No records beaten yet. Warm-up sets never count."}
              </p>
            ) : (
              <ol className="card divide-y divide-separator">
                {recordHistory.map((event) => (
                  <li key={event.date} className="flex gap-4 px-4 py-3">
                    <span className="w-16 shrink-0 text-xs font-medium text-label-3">{formatDate(event.date)}</span>
                    <ul className="min-w-0 text-sm">
                      {event.records.map((r) => (
                        <li key={r.kind}>{describePersonalRecord(r, "kg")}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>
      )}
    </main>
  );
}
