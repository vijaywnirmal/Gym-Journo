import Link from "next/link";
import { getExercises, getLogForDate, getPlanForDate, getPreviousPerformance } from "@/lib/queries";
import { formatDate } from "@/lib/date";
import { getToday } from "@/lib/userDate";
import { createClient } from "@/lib/supabase/server";
import type { PreviousPerformance } from "@/lib/queries";
import LogForm from "./LogForm";
import HistoricalLogView from "./HistoricalLogView";

export default async function LogPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [exercises, plan, log] = await Promise.all([
    getExercises(),
    getPlanForDate(date),
    getLogForDate(date),
  ]);

  // A previously-logged day (any date other than today that already has a log) defaults to the
  // read-first summary view instead of the active-execution stepper — see HistoricalLogView.
  // Today always gets the normal execution experience regardless of completion state, and any
  // date with no log yet has nothing to review, so it also gets the normal starting flow.
  const isHistorical = date !== (await getToday()) && log !== null;

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
      {isHistorical ? (
        <HistoricalLogView
          date={date}
          exercises={exercises}
          plan={plan}
          existingLog={log!}
          initialPreviousPerformance={initialPreviousPerformance}
        />
      ) : (
        <>
          <h1 className="mb-1 text-xl font-bold">Log for {formatDate(date)}</h1>
          {plan?.title && <p className="mb-4 text-sm text-neutral-500">Scheduled: {plan.title}</p>}
          {!plan?.title && <div className="mb-4" />}
          <LogForm
            date={date}
            exercises={exercises}
            plan={plan}
            existingLog={log}
            initialPreviousPerformance={initialPreviousPerformance}
            backupScope={user?.id ?? null}
          />
        </>
      )}
    </main>
  );
}
