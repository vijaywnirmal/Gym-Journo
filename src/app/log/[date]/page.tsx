import Link from "next/link";
import { getExercises, getLogForDate, getPlanForDate, getPreviousPerformance } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import type { PreviousPerformance } from "@/lib/queries";
import LogForm from "./LogForm";

export default async function LogPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const [exercises, plan, log] = await Promise.all([
    getExercises(),
    getPlanForDate(date),
    getLogForDate(date),
  ]);

  // Preload "last time" context for every exercise already on the page, so it's available the
  // moment the execution UI renders. Exercises added later in the session (unplanned) are
  // fetched on demand via fetchPreviousPerformance instead.
  const initialExerciseIds = new Set<string>([
    ...(log?.logged_exercises?.map((le) => le.exercise_id) ?? []),
    ...(plan?.planned_exercises?.map((pe) => pe.exercise_id) ?? []),
  ]);
  const previousEntries = await Promise.all(
    [...initialExerciseIds].map(
      async (id) => [id, await getPreviousPerformance(id, date)] as const
    )
  );
  const initialPreviousPerformance: Record<string, PreviousPerformance | null> =
    Object.fromEntries(previousEntries);

  return (
    <main className="px-4 pt-6">
      <Link href="/calendar" className="mb-1 inline-block text-sm text-neutral-500">
        ← Calendar
      </Link>
      <h1 className="mb-1 text-xl font-bold">Log for {formatDate(date)}</h1>
      {plan?.title && <p className="mb-4 text-sm text-neutral-500">Scheduled: {plan.title}</p>}
      {!plan?.title && <div className="mb-4" />}
      <LogForm
        date={date}
        exercises={exercises}
        plan={plan}
        existingLog={log}
        initialPreviousPerformance={initialPreviousPerformance}
      />
    </main>
  );
}
