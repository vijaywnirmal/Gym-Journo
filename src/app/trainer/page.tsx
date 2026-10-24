import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { formatDateLong, hourIn, todayIn } from "@/lib/date";
import { getGreeting } from "@/lib/home";
import { getUserTimeZone } from "@/lib/userDate";
import { clientName, lastWorkoutLine, todayStatus, trainerToday } from "@/lib/clientStatus";
import { getTrainerFees } from "@/lib/feeQueries";
import { feeStateLabel, feesDue } from "@/lib/fees";
import { getClientOverview, getMyTrainerProfile } from "@/lib/trainers";
import type { ClientOverview } from "@/lib/types";
import DayStatusPill from "./DayStatusPill";

export const metadata: Metadata = { title: "Today" };

// The trainer's home: today's sessions across clients, who has nothing planned this week, who has
// gone quiet, and whose fee is due. Each row opens the client's week.
export default async function TrainerTodayPage() {
  const trainer = await getMyTrainerProfile();
  if (!trainer) redirect("/trainer/setup");
  const [clients, fees, { timeZone }] = await Promise.all([getClientOverview(), getTrainerFees(), getUserTimeZone()]);
  const view = trainerToday(clients);
  const due = feesDue(fees, todayIn(timeZone));
  const feesToChase = clients.filter((row) => due.has(row.client_id));

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title={getGreeting(trainer.display_name, hourIn(timeZone))}
        subtitle={formatDateLong(todayIn(timeZone))}
      />

      {clients.length === 0 ? (
        <section className="card p-4">
          <p className="text-sm font-semibold">No clients yet</p>
          <p className="mt-0.5 text-sm text-label-2">
            Send your invite link on WhatsApp. Clients show up here once they accept.
          </p>
          <Link href="/trainer/invite" className="mt-3 inline-block text-sm font-semibold text-link">
            Invite a client
          </Link>
        </section>
      ) : (
        <>
          <p className="text-sm text-label-2">
            {view.plannedThisWeek > 0
              ? `${view.doneThisWeek} of ${view.plannedThisWeek} planned sessions done this week`
              : `${view.doneThisWeek} workout${view.doneThisWeek === 1 ? "" : "s"} logged this week`}
            {" · "}
            <Link href="/trainer/clients" className="text-link">
              All clients
            </Link>
          </p>

          <Section title="Today" empty="No sessions planned for today.">
            {view.today.map((row) => (
              <ClientRow key={row.client_id} row={row} line={lastWorkoutLine(row)} pill />
            ))}
          </Section>

          {view.needPlan.length > 0 && (
            <Section title="Nothing planned this week">
              {view.needPlan.map((row) => (
                <ClientRow key={row.client_id} row={row} line="Plan their week" />
              ))}
            </Section>
          )}

          {view.quiet.length > 0 && (
            <Section title="Not training">
              {view.quiet.map((row) => (
                <ClientRow key={row.client_id} row={row} line={lastWorkoutLine(row)} warn />
              ))}
            </Section>
          )}

          {feesToChase.length > 0 && (
            <Section title="Fees due">
              {feesToChase.map((row) => {
                const state = due.get(row.client_id)!;
                return <ClientRow key={row.client_id} row={row} line={feeStateLabel(state)} warn={state.kind === "overdue"} />;
              })}
            </Section>
          )}
        </>
      )}
    </main>
  );
}

function Section({ title, empty, children }: { title: string; empty?: string; children: React.ReactNode[] }) {
  return (
    <>
      <h2 className="section-title mt-6">{title}</h2>
      {children.length === 0 ? (
        <p className="px-1 text-sm text-label-2">{empty}</p>
      ) : (
        <ul className="card divide-y divide-separator">{children}</ul>
      )}
    </>
  );
}

function ClientRow({ row, line, pill = false, warn = false }: { row: ClientOverview; line: string; pill?: boolean; warn?: boolean }) {
  return (
    <li>
      <Link href={`/trainer/clients/${row.client_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fill">
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">{clientName(row)}</span>
          <span className={`block text-sm ${warn ? "text-orange" : "text-label-2"}`}>{line}</span>
        </span>
        {pill && <DayStatusPill status={todayStatus(row)} />}
        <Icon name="chevronRight" className="size-4 shrink-0 text-label-3" strokeWidth={2} />
      </Link>
    </li>
  );
}
