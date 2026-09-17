import Link from "next/link";
import { getExercises, getLogHistory } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import ExerciseFilter from "./ExerciseFilter";

const PAGE_SIZE = 30;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string; before?: string }>;
}) {
  const { exercise: exerciseId, before } = await searchParams;
  const [{ logs, hasMore }, exercises] = await Promise.all([
    getLogHistory({ exerciseId, before, pageSize: PAGE_SIZE }),
    getExercises(),
  ]);

  const oldestDateOnPage = logs.length > 0 ? logs[logs.length - 1].date : null;
  const filterQuery = exerciseId ? `exercise=${exerciseId}&` : "";
  const backToRecentHref = exerciseId ? `/history?exercise=${exerciseId}` : "/history";
  // Looked up independently of `logs` so the heading still has a name when the filtered result
  // set is empty (e.g. an exercise with no logged sessions yet).
  const selectedExerciseName = exerciseId
    ? exercises.find((ex) => ex.id === exerciseId)?.name ?? "Exercise"
    : null;

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold">History</h1>

      <div className="mb-5">
        <ExerciseFilter exercises={exercises} selectedId={exerciseId} />
      </div>

      {selectedExerciseName && (
        <h2 className="mb-3 text-lg font-semibold text-neutral-100">{selectedExerciseName}</h2>
      )}

      <div className="flex flex-col gap-3 pb-4">
        {logs.length === 0 && (
          <p className="text-sm text-neutral-500">
            {before ? "No older workouts." : "No workouts logged yet."}
          </p>
        )}
        {selectedExerciseName
          ? logs.map((log) => (
              <Link
                key={log.id}
                href={`/log/${log.date}`}
                className="block rounded-xl border border-neutral-800 p-4"
              >
                <p className="mb-2 font-semibold text-neutral-100">{formatDate(log.date)}</p>
                <ul className="flex flex-col gap-1 text-sm text-neutral-300">
                  {log.logged_exercises?.[0]?.logged_sets?.map((s) => (
                    <li key={s.id} className="flex items-center gap-2">
                      <span className="w-12 text-neutral-500">Set {s.set_number}</span>
                      <span>
                        {s.weight ?? "?"}
                        {s.weight_unit} × {s.reps ?? "?"}
                      </span>
                    </li>
                  ))}
                  {(log.logged_exercises?.[0]?.logged_sets?.length ?? 0) === 0 && (
                    <li className="text-neutral-500">No sets recorded.</li>
                  )}
                </ul>
              </Link>
            ))
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
                          ?.map((s) => `${s.reps ?? "?"}×${s.weight ?? "?"}${s.weight_unit}`)
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
