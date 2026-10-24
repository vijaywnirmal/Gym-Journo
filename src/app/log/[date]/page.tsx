import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getLogForDate, getPlanForDate, getPreviousPerformance } from "@/lib/queries";
import { formatDate, formatDateLong, isValidIsoDate } from "@/lib/date";
import { getToday } from "@/lib/userDate";
import { createClient } from "@/lib/supabase/server";
import type { PreviousPerformance } from "@/lib/queries";
import LogForm from "./LogForm";
import HistoricalLogView from "./HistoricalLogView";
import LogModeSwitch from "./LogModeSwitch";
import BackLink from "@/components/BackLink";
import PageHeader from "@/components/PageHeader";
import Icon from "@/components/Icon";
import { requireMemberApp } from "@/lib/workAccount";

// The day in the title, so each day's page is announced on its own.
export async function generateMetadata({ params }: { params: Promise<{ date: string }> }): Promise<Metadata> {
  const { date } = await params;
  return { title: isValidIsoDate(date) ? `Log · ${formatDate(date)}` : "Log" };
}

export default async function LogPage({
  params,
  searchParams,
}: {
  params: Promise<{ date: string }>;
  searchParams: Promise<{ lighter?: string }>;
}) {
  await requireMemberApp();
  const { date } = await params;
  if (!isValidIsoDate(date)) notFound();
  const today = await getToday();

  // A log is a record of what was done, so a future day can only be planned, not logged.
  // (saveLog enforces the same rule on the server.)
  if (date > today) {
    return (
      <main className="px-4 pt-6 md:px-8 md:pt-10">
        <PageHeader title={formatDate(date)} back={{ href: "/calendar", label: "Calendar" }} />
        <section className="card flex flex-col items-center px-6 py-10 text-center">
          <span className="mb-3 grid size-11 place-items-center rounded-full bg-fill text-label-2">
            <Icon name="calendar" className="size-5" />
          </span>
          <h2 className="text-lg font-semibold">This day hasn&apos;t happened yet</h2>
          <p className="mt-1 mb-5 max-w-xs text-sm text-label-2">
            You can log a workout on {formatDateLong(date)} or after. Until then, plan what you&apos;ll do.
          </p>
          <div className="flex gap-2">
            <Link
              href={`/schedule/${date}`}
              className="flex h-10 items-center rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover"
            >
              Plan this day
            </Link>
            <Link
              href={`/log/${today}`}
              className="flex h-10 items-center rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
            >
              Log today
            </Link>
          </div>
        </section>
      </main>
    );
  }

  // "Start a lighter session" from Today's welcome-back card (lib/analyze/comeback.ts).
  const lighter = (await searchParams).lighter === "1";
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const [plan, log] = await Promise.all([getPlanForDate(date), getLogForDate(date)]);

  // A previously-logged day (any date other than today that already has a log) opens on the
  // read-first summary view instead of the active-execution stepper — see HistoricalLogView.
  // Today always gets the normal execution experience regardless of completion state, and any
  // date with no log yet has nothing to review, so it also gets the normal starting flow.
  // LogModeSwitch keeps whichever view the page opened on, so the log a first save creates
  // doesn't swap the logger for the summary mid-entry.
  const isHistorical = date !== today && log !== null;

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
    <main className="px-4 pt-6 md:px-8 md:pt-10">
      <LogModeSwitch
        key={date}
        startWithSummary={isHistorical}
        summary={
          log && (
            <>
              <BackLink href="/calendar" label="Calendar" />
              <HistoricalLogView
                date={date}
                plan={plan}
                existingLog={log}
                initialPreviousPerformance={initialPreviousPerformance}
                backupScope={user?.id ?? null}
              />
            </>
          )
        }
        logger={
          <>
            <PageHeader
              title={date === today ? "Today's workout" : formatDate(date)}
              subtitle={plan?.title ? `Planned: ${plan.title}` : date === today ? formatDateLong(date) : "Logging a past day"}
              back={{ href: date === today ? "/" : "/calendar", label: date === today ? "Today" : "Calendar" }}
            />
            <LogForm
              date={date}
              plan={plan}
              existingLog={log}
              initialPreviousPerformance={initialPreviousPerformance}
              backupScope={user?.id ?? null}
              lighter={lighter}
            />
          </>
        }
      />
    </main>
  );
}
