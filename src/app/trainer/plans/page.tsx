import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { isValidIsoDate, shiftDate, todayIn } from "@/lib/date";
import { getUserTimeZone } from "@/lib/userDate";
import { clientName, dayStatus, mondayOf, weekFrom, type DayStatus } from "@/lib/clientStatus";
import { getClientLogs, getClientOverview, getClientPlans, getMyTrainerProfile } from "@/lib/trainers";
import type { ClientOverview } from "@/lib/types";
import DayStatusPill from "../DayStatusPill";

export const metadata: Metadata = { title: "Plans" };

type Entry = { client: ClientOverview; title: string; status: DayStatus };

// Every client's week on one screen (Monday to Sunday): what's planned each day and what got done.
// Each entry opens that client's day to plan or change it.
export default async function TrainerPlansPage({ searchParams }: PageProps<"/trainer/plans">) {
  const trainer = await getMyTrainerProfile();
  if (!trainer) redirect("/trainer/setup");
  const [{ week }, clients, { timeZone }] = await Promise.all([searchParams, getClientOverview(), getUserTimeZone()]);

  const today = todayIn(timeZone);
  const thisMonday = mondayOf(today);
  const monday = typeof week === "string" && isValidIsoDate(week) ? mondayOf(week) : thisMonday;
  const days = weekFrom(monday);
  const weeks = await Promise.all(
    clients.map(async (client) => {
      const [plans, logs] = await Promise.all([
        getClientPlans(client.client_id, days[0], days[6]),
        getClientLogs(client.client_id, days[0], days[6]),
      ]);
      return { client, planOn: new Map(plans.map((p) => [p.date, p])), logOn: new Map(logs.map((l) => [l.date, l])) };
    })
  );
  const entriesOn = (date: string): Entry[] =>
    weeks.flatMap(({ client, planOn, logOn }) => {
      const plan = planOn.get(date);
      const status = dayStatus(plan, logOn.get(date), date, client.client_today);
      if (status === "none") return [];
      const title = plan?.title || (status === "rest" ? "Rest day" : status === "absence" ? "Day off" : "Workout");
      return [{ client, title, status }];
    });

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader title="Plans" subtitle="Your clients' week" />

      <div className="mb-2 flex items-center justify-between gap-2">
        <Link href={`/trainer/plans?week=${shiftDate(monday, -7)}`} aria-label="Previous week" className="grid size-9 place-items-center rounded-lg hover:bg-fill">
          <Icon name="chevronLeft" className="size-4" strokeWidth={2.25} />
        </Link>
        <p className="text-sm font-semibold">
          {format(parseISO(days[0]), "MMM d")} – {format(parseISO(days[6]), "MMM d")}
          {monday !== thisMonday && (
            <Link href="/trainer/plans" className="ml-1 inline-flex h-9 items-center rounded-lg px-2 font-medium text-link hover:bg-fill">
              Back to this week
            </Link>
          )}
        </p>
        <Link href={`/trainer/plans?week=${shiftDate(monday, 7)}`} aria-label="Next week" className="grid size-9 place-items-center rounded-lg hover:bg-fill">
          <Icon name="chevronRight" className="size-4" strokeWidth={2.25} />
        </Link>
      </div>

      {clients.length === 0 ? (
        <section className="card p-4">
          <p className="text-sm text-label-2">Your clients&apos; plans show up here once they accept your invite.</p>
          <Link href="/trainer/invite" className="mt-2 inline-block text-sm font-semibold text-link">
            Invite a client
          </Link>
        </section>
      ) : (
        days.map((date) => {
          const entries = entriesOn(date);
          return (
            <section key={date} className="mt-4">
              <h2 className="section-title">
                {format(parseISO(date), "EEE, MMM d")}
                {date === today && " · Today"}
              </h2>
              {entries.length === 0 ? (
                <p className="px-1 text-sm text-label-2">Nothing planned</p>
              ) : (
                <ul className="card divide-y divide-separator">
                  {entries.map(({ client, title, status }) => (
                    <li key={client.client_id}>
                      <Link
                        href={`/trainer/clients/${client.client_id}/plan/${date}`}
                        className="flex items-center gap-3 px-4 py-3 hover:bg-fill"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold">{clientName(client)}</span>
                          <span className="block truncate text-sm text-label-2">{title}</span>
                        </span>
                        <DayStatusPill status={status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </main>
  );
}
