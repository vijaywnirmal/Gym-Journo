import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { format, parseISO } from "date-fns";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import TrendChart from "@/components/TrendChart";
import { isValidIsoDate, shiftDate } from "@/lib/date";
import { clientName, clientSummary, dayStatus, mondayOf, weekFrom } from "@/lib/clientStatus";
import { formatSetCompact } from "@/lib/setData";
import { editedByClient } from "@/lib/planAuthors";
import { getClient, getClientBodyWeights, getClientLogs, getClientPlans } from "@/lib/trainers";
import type { ClientLog, ClientPlan } from "@/lib/types";
import DayStatusPill from "../../DayStatusPill";
import EndCoaching from "./EndCoaching";

export const metadata: Metadata = { title: "Client" };

// Up to this many sets per exercise on one line; the rest are counted.
const SETS_SHOWN = 4;

function planLine(plan: ClientPlan | undefined): string | null {
  if (!plan) return null;
  if (plan.is_rest_day) return plan.title;
  const names = plan.exercises.map((e) => e.name);
  return [plan.title, names.length ? `${names.length} exercise${names.length === 1 ? "" : "s"}` : null]
    .filter(Boolean)
    .join(" · ");
}

function LoggedWorkout({ log }: { log: ClientLog }) {
  return (
    <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-label-2">
      {log.exercises
        .filter((ex) => ex.sets.length > 0)
        .map((ex) => {
          const sets = ex.sets.map(formatSetCompact);
          const extra = sets.length - SETS_SHOWN;
          return (
            <p key={`${ex.position}-${ex.exercise_id}`}>
              <span className="font-medium text-label">{ex.name}</span> {sets.slice(0, SETS_SHOWN).join(", ")}
              {extra > 0 && ` +${extra}`}
              {ex.notes && <span className="italic"> · {ex.notes}</span>}
            </p>
          );
        })}
      {log.notes && <p className="italic">“{log.notes}”</p>}
    </div>
  );
}

export default async function ClientPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const [{ id }, { week }] = await Promise.all([params, searchParams]);
  const client = await getClient(id);
  if (!client) notFound();

  const today = client.client_today;
  const thisMonday = mondayOf(today);
  const monday = week && isValidIsoDate(week) ? mondayOf(week) : thisMonday;
  const days = weekFrom(monday);
  const [plans, logs, weights] = await Promise.all([
    getClientPlans(id, days[0], days[6]),
    getClientLogs(id, days[0], days[6]),
    getClientBodyWeights(id, shiftDate(today, -90), today),
  ]);
  const planOn = new Map(plans.map((p) => [p.date, p]));
  const logOn = new Map(logs.map((l) => [l.date, l]));
  const name = clientName(client);
  const firstName = client.first_name || name;
  const base = `/trainer/clients/${id}`;

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader title={name} subtitle={clientSummary(client) || undefined} back={{ href: "/trainer/clients", label: "Clients" }} />

      <div className="mb-2 flex items-center justify-between gap-2">
        <Link href={`${base}?week=${shiftDate(monday, -7)}`} aria-label="Previous week" className="grid size-9 place-items-center rounded-lg hover:bg-fill">
          <Icon name="chevronLeft" className="size-4" strokeWidth={2.25} />
        </Link>
        <p className="text-sm font-semibold">
          {format(parseISO(days[0]), "MMM d")} – {format(parseISO(days[6]), "MMM d")}
          {monday !== thisMonday && (
            <Link href={base} className="ml-1 inline-flex h-9 items-center rounded-lg px-2 font-medium text-link hover:bg-fill">
              Back to this week
            </Link>
          )}
        </p>
        <Link href={`${base}?week=${shiftDate(monday, 7)}`} aria-label="Next week" className="grid size-9 place-items-center rounded-lg hover:bg-fill">
          <Icon name="chevronRight" className="size-4" strokeWidth={2.25} />
        </Link>
      </div>

      <ul className="card divide-y divide-separator">
        {days.map((date) => {
          const plan = planOn.get(date);
          const log = logOn.get(date);
          const status = dayStatus(plan, log, date, today);
          return (
            <li key={date}>
              <Link href={`${base}/plan/${date}`} className="flex gap-3 px-4 py-3 hover:bg-fill">
                <span className={`w-10 shrink-0 text-center ${date === today ? "text-link" : "text-label-2"}`}>
                  <span className="block text-[11px] font-semibold uppercase">{format(parseISO(date), "EEE")}</span>
                  <span className="block text-lg leading-tight font-semibold">{format(parseISO(date), "d")}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    {status === "none" ? (
                      <span className="min-w-0 flex-1 text-sm text-label-3">Not planned</span>
                    ) : (
                      <>
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {planLine(plan) ?? "Logged without a plan"}
                        </span>
                        <DayStatusPill status={status} />
                      </>
                    )}
                  </span>
                  {plan && editedByClient(plan, id) && <span className="block text-xs text-label-2">Edited by {firstName}</span>}
                  {status === "done" && log && <LoggedWorkout log={log} />}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <Link href={`${base}/programs`} className="card mt-3 flex items-center gap-3 px-4 py-3 hover:bg-fill">
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold">Apply a program</span>
          <span className="block text-sm text-label-2">Schedule weeks of workouts for {firstName} at once</span>
        </span>
        <Icon name="chevronRight" className="size-4 text-label-3" strokeWidth={2} />
      </Link>

      <h2 className="section-title mt-8">Body weight</h2>
      <section className="card p-4">
        <TrendChart points={weights.map((w) => ({ date: w.date, value: w.weight_kg }))} unit="kg" />
      </section>

      <div className="mt-8">
        <EndCoaching linkId={client.link_id} name={firstName} />
      </div>
    </main>
  );
}
