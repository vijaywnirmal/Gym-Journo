import { getExerciseSessions, getExercises } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import {
  bestEstimatedOneRepMax,
  buildProgressPoints,
  heaviestSet,
} from "@/lib/analyze/progress";
import ExerciseFilter from "@/app/history/ExerciseFilter";
import TrendChart from "@/components/TrendChart";

function round1(value: number): string {
  return (Math.round(value * 10) / 10).toString();
}

export default async function ProgressPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const { exercise: exerciseId } = await searchParams;
  const [exercises, sessions] = await Promise.all([
    getExercises(),
    exerciseId ? getExerciseSessions(exerciseId) : Promise.resolve([]),
  ]);

  const selectedExerciseName = exerciseId
    ? exercises.find((ex) => ex.id === exerciseId)?.name ?? "Exercise"
    : null;

  const points = buildProgressPoints(sessions);
  const pr = heaviestSet(sessions);
  const e1rm = bestEstimatedOneRepMax(sessions);

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold">Progress</h1>

      <div className="mb-5">
        <ExerciseFilter exercises={exercises} selectedId={exerciseId} basePath="/progress" />
      </div>

      {!exerciseId && (
        <p className="text-sm text-neutral-500">Pick an exercise to see its progress over time.</p>
      )}

      {exerciseId && sessions.length === 0 && (
        <p className="text-sm text-neutral-500">
          No performed sessions recorded for {selectedExerciseName} yet.
        </p>
      )}

      {exerciseId && sessions.length > 0 && (
        <div className="flex flex-col gap-6 pb-6">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-neutral-800 p-4">
              <p className="text-xs text-neutral-500">Heaviest set</p>
              <p className="text-lg font-semibold text-neutral-100">
                {pr ? `${round1(pr.weightKg)} kg × ${pr.reps}` : "—"}
              </p>
              {pr && <p className="text-xs text-neutral-500">{formatDate(pr.date)}</p>}
            </div>
            <div className="rounded-xl border border-neutral-800 p-4">
              <p className="text-xs text-neutral-500">Best est. 1RM</p>
              <p className="text-lg font-semibold text-neutral-100">
                {e1rm ? `${round1(e1rm.e1rmKg)} kg` : "—"}
              </p>
              {e1rm && <p className="text-xs text-neutral-500">{formatDate(e1rm.date)}</p>}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-100">Estimated 1RM over time</p>
            <TrendChart
              points={points
                .filter((p) => p.e1rmKg !== null)
                .map((p) => ({ date: p.date, value: p.e1rmKg as number }))}
              unit="kg"
            />
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-neutral-100">Volume per session</p>
            <TrendChart points={points.map((p) => ({ date: p.date, value: p.volumeKg }))} unit="kg" />
          </div>
        </div>
      )}
    </main>
  );
}
