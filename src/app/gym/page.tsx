import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { getAdminGym, getGymMembers, getGymTrainers } from "@/lib/gyms";
import { gymSummary } from "@/lib/gymStatus";
import { getGymFees, getGymPaymentsSince } from "@/lib/feeQueries";
import { collectedThisMonth, feesDue, formatRupees } from "@/lib/fees";
import { todayIn } from "@/lib/date";
import { getUserTimeZone } from "@/lib/userDate";

export const metadata: Metadata = { title: "Dashboard" };

function plural(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

// The gym's home: how its members are doing this week, who needs a trainer, fees (once it records
// any), and its trainers.
export default async function GymDashboardPage() {
  const [gym, { timeZone }] = await Promise.all([getAdminGym(), getUserTimeZone()]);
  if (!gym) redirect("/gym/setup");
  const today = todayIn(timeZone);
  const [members, trainers, fees, payments] = await Promise.all([
    getGymMembers(gym.id),
    getGymTrainers(gym.id),
    getGymFees(gym.id),
    getGymPaymentsSince(gym.id, `${today.slice(0, 7)}-01`),
  ]);
  const summary = gymSummary(members);
  const due = [...feesDue(fees, today).values()];
  const overdue = due.filter((state) => state.kind === "overdue").length;
  const place = [gym.area, gym.city].filter(Boolean).join(", ");

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title={gym.name}
        subtitle={
          <>
            {place && `${place} · `}
            <Link href="/gym/setup" className="text-link">
              Gym details
            </Link>
          </>
        }
        actions={
          <Link
            href="/gym/invite"
            className="flex h-9 items-center gap-1 rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
          >
            <Icon name="plus" className="size-4" strokeWidth={2.5} />
            Invite
          </Link>
        }
      />

      {members.length === 0 ? (
        <section className="card p-4">
          <p className="text-sm font-semibold">No members yet</p>
          <p className="mt-0.5 text-sm text-label-2">
            Put up the poster at your front desk. Members show up here once they scan it and join.
          </p>
          <Link href="/gym/invite" className="mt-3 inline-block text-sm font-semibold text-link">
            Get the poster
          </Link>
        </section>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <Tile
            href="/gym/members"
            value={summary.members}
            label="Members"
            note={summary.joinedThisWeek > 0 ? `${summary.joinedThisWeek} joined this week` : undefined}
          />
          <Tile
            href="/gym/members"
            value={summary.trainedThisWeek}
            label="Trained this week"
            note={`of ${plural(summary.members, "member")}`}
          />
          <Tile
            href="/gym/members?filter=quiet"
            value={summary.notTraining}
            label="Not training"
            note="No workout in 7 days"
            warn={summary.notTraining > 0}
          />
          <Tile
            href="/gym/members?filter=needs-trainer"
            value={summary.needTrainer}
            label="Need a trainer"
            note={summary.waitingToAccept > 0 ? `${summary.waitingToAccept} waiting to accept` : undefined}
            warn={summary.needTrainer > 0}
          />
          {(fees.size > 0 || payments.length > 0) && (
            <>
              <Tile
                href="/gym/members?filter=fees-due"
                value={due.length}
                label="Fees due"
                note={overdue > 0 ? `${overdue} overdue` : "This week"}
                warn={overdue > 0}
              />
              <Tile
                href="/gym/members"
                value={formatRupees(collectedThisMonth(payments, today))}
                label="Collected"
                note="This month"
              />
            </>
          )}
        </div>
      )}

      <h2 className="section-title mt-8">Trainers</h2>
      {trainers.length === 0 ? (
        <section className="card p-4">
          <p className="text-sm text-label-2">No trainers yet. Send your trainers the invite link on WhatsApp.</p>
          <Link href="/gym/invite" className="mt-2 inline-block text-sm font-semibold text-link">
            Invite a trainer
          </Link>
        </section>
      ) : (
        <ul className="card divide-y divide-separator">
          {trainers.map((t) => (
            <li key={t.trainer_id}>
              <Link
                href={t.members_assigned > 0 ? `/gym/members?trainer=${t.trainer_id}` : "/gym/trainers"}
                className="flex items-center gap-3 px-4 py-3 hover:bg-fill"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{t.display_name}</span>
                  <span className="block text-sm text-label-2">
                    {plural(t.members_assigned, "member")} · {plural(t.plans_this_week, "plan")} for this week
                  </span>
                  {t.members_inactive_7_days > 0 && (
                    <span className="block text-xs text-orange">{t.members_inactive_7_days} not training in the last 7 days</span>
                  )}
                </span>
                <Icon name="chevronRight" className="size-4 shrink-0 text-label-3" strokeWidth={2} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function Tile({
  href,
  value,
  label,
  note,
  warn = false,
}: {
  href: string;
  value: number | string;
  label: string;
  note?: string;
  warn?: boolean;
}) {
  return (
    <Link href={href} className="card flex flex-col p-4 hover:bg-fill">
      <span className={`text-2xl font-semibold tabular-nums ${warn ? "text-orange" : ""}`}>{value}</span>
      <span className="text-sm font-medium">{label}</span>
      {note && <span className="text-xs text-label-2">{note}</span>}
    </Link>
  );
}
