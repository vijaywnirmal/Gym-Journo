import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { daysSince } from "@/lib/date";
import { QUIET_AFTER_DAYS } from "@/lib/gymStatus";
import { clientName, todayStatus } from "@/lib/clientStatus";
import { getClientOverview, getMyTrainerProfile } from "@/lib/trainers";
import type { ClientOverview } from "@/lib/types";
import DayStatusPill from "./DayStatusPill";

export const metadata: Metadata = { title: "Clients" };

function weekLine(row: ClientOverview): string {
  const done = `${row.done_this_week} workout${row.done_this_week === 1 ? "" : "s"}`;
  return row.planned_this_week > 0 ? `${row.done_this_week} of ${row.planned_this_week} this week` : `${done} this week`;
}

// No workout in a week (or ever): shown in orange so a client going quiet stands out.
function isQuiet(row: ClientOverview): boolean {
  return !row.last_workout_on || daysSince(row.last_workout_on, row.client_today) >= QUIET_AFTER_DAYS;
}

function lastWorkout(row: ClientOverview): string {
  if (!row.last_workout_on) return "No workouts yet";
  const days = daysSince(row.last_workout_on, row.client_today);
  if (days === 0) return "Last workout today";
  if (days === 1) return "Last workout yesterday";
  return `Last workout ${days} days ago`;
}

export default async function ClientsPage() {
  const trainer = await getMyTrainerProfile();
  if (!trainer) redirect("/trainer/setup");
  const clients = await getClientOverview();

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title="Clients"
        actions={
          <Link
            href="/trainer/invite"
            className="flex h-9 items-center gap-1 rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
          >
            <Icon name="plus" className="size-4" strokeWidth={2.5} />
            Invite
          </Link>
        }
      />

      {clients.length === 0 ? (
        <section className="card p-4">
          <p className="text-sm font-semibold">No clients yet</p>
          <p className="mt-0.5 text-sm text-label-2">
            Send your invite link on WhatsApp. Clients show up here once they accept.
          </p>
        </section>
      ) : (
        <ul className="card divide-y divide-separator">
          {clients.map((row) => (
            <li key={row.client_id}>
              <Link href={`/trainer/clients/${row.client_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fill">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{clientName(row)}</span>
                  <span className="block text-sm text-label-2">{weekLine(row)}</span>
                  <span className={`block text-xs ${isQuiet(row) ? "font-medium text-orange" : "text-label-2"}`}>{lastWorkout(row)}</span>
                </span>
                <DayStatusPill status={todayStatus(row)} />
                <Icon name="chevronRight" className="size-4 shrink-0 text-label-3" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
