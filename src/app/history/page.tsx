import Link from "next/link";
import { getExercises, getLogHistory } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import ExerciseFilter from "./ExerciseFilter";

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ exercise?: string }>;
}) {
  const { exercise: exerciseId } = await searchParams;
  const [logs, exercises] = await Promise.all([
    getLogHistory(exerciseId),
    getExercises(),
  ]);

  return (
    <main className="px-4 pt-6">
      <h1 className="mb-4 text-xl font-bold">History</h1>

      <div className="mb-5">
        <ExerciseFilter exercises={exercises} selectedId={exerciseId} />
      </div>

      <div className="flex flex-col gap-3 pb-6">
        {logs.length === 0 && (
          <p className="text-sm text-neutral-500">No workouts logged yet.</p>
        )}
        {logs.map((log) => (
          <Link
            key={log.id}
            href={`/log/${log.date}`}
            className="block rounded-xl border border-neutral-800 p-4"
          >
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold text-neutral-100">{formatDate(log.date)}</p>
              {log.completed_at && <span className="text-xs text-green-400">Completed</span>}
            </div>
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
          </Link>
        ))}
      </div>
    </main>
  );
}
