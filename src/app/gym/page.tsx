import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { getAdminGym, getGymMembers } from "@/lib/gyms";
import { filterMembers, isQuiet, lastWorkoutLabel, memberName, needsTrainer, trainerLabel, type MemberFilter } from "@/lib/gymStatus";
import GymTabs from "./GymTabs";

export const metadata: Metadata = { title: "Gym" };

const FILTERS: { key: MemberFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "needs-trainer", label: "Needs a trainer" },
  { key: "quiet", label: "Not training" },
];

export default async function GymPage({ searchParams }: PageProps<"/gym">) {
  const gym = await getAdminGym();
  if (!gym) redirect("/gym/setup");
  const { filter: filterParam } = await searchParams;
  const filter = FILTERS.find((f) => f.key === filterParam)?.key ?? "all";
  const members = await getGymMembers(gym.id);
  const shown = filterMembers(members, filter);

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title={gym.name}
        subtitle={`${members.length} member${members.length === 1 ? "" : "s"}`}
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
      <GymTabs current="members" />

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
        <>
          <div className="mb-3 flex gap-1.5 overflow-x-auto" role="group" aria-label="Show">
            {FILTERS.map((f) => {
              const count = filterMembers(members, f.key).length;
              const active = f.key === filter;
              return (
                <Link
                  key={f.key}
                  href={f.key === "all" ? "/gym" : `/gym?filter=${f.key}`}
                  aria-current={active ? "true" : undefined}
                  className={`flex h-8 shrink-0 items-center rounded-full px-3 text-sm font-medium ${
                    active ? "bg-label text-background" : "bg-fill text-label-2 hover:text-label"
                  }`}
                >
                  {f.label}
                  {f.key !== "all" && <span className="ml-1.5 tabular-nums opacity-70">{count}</span>}
                </Link>
              );
            })}
          </div>
          {shown.length === 0 ? (
            <p className="px-1 text-sm text-label-2">
              {filter === "needs-trainer" ? "Everyone has a trainer." : "Everyone has trained in the last 7 days."}
            </p>
          ) : (
            <ul className="card divide-y divide-separator">
              {shown.map((row) => (
                <li key={row.member_id}>
                  <Link href={`/gym/members/${row.member_id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-fill">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{memberName(row)}</span>
                      <span className={`block truncate text-sm ${needsTrainer(row) ? "text-orange" : "text-label-2"}`}>
                        {trainerLabel(row)}
                      </span>
                      <span className={`block text-xs ${isQuiet(row) ? "text-orange" : "text-label-2"}`}>
                        {row.workouts_this_week} this week · {lastWorkoutLabel(row)}
                      </span>
                    </span>
                    <Icon name="chevronRight" className="size-4 shrink-0 text-label-3" strokeWidth={2} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
