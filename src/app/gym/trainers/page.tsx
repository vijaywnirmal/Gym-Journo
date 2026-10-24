import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import Icon from "@/components/Icon";
import PageHeader from "@/components/PageHeader";
import { getCurrentUser } from "@/lib/currentUser";
import { getAdminGym, getGymAdmins, getGymTrainers } from "@/lib/gyms";
import { joinName } from "@/lib/names";
import { removeStaff } from "../actions";
import GymTabs from "../GymTabs";
import RemoveButton from "@/components/RemoveButton";

export const metadata: Metadata = { title: "Trainers" };

function count(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export default async function GymTrainersPage() {
  const gym = await getAdminGym();
  if (!gym) redirect("/gym/setup");
  const [trainers, admins, user] = await Promise.all([
    getGymTrainers(gym.id),
    gym.isOwner ? getGymAdmins(gym.id) : Promise.resolve([]),
    getCurrentUser(),
  ]);

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title={gym.name}
        subtitle={
          <>
            {count(trainers.length, "trainer")} ·{" "}
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
      <GymTabs current="trainers" />

      {trainers.length === 0 ? (
        <section className="card p-4">
          <p className="text-sm font-semibold">No trainers yet</p>
          <p className="mt-0.5 text-sm text-label-2">Send your trainers the invite link on WhatsApp.</p>
          <Link href="/gym/invite" className="mt-3 inline-block text-sm font-semibold text-link">
            Invite a trainer
          </Link>
        </section>
      ) : (
        <ul className="flex flex-col gap-3">
          {trainers.map((t) => (
            <li key={t.trainer_id} className="card divide-y divide-separator">
              <div className="px-4 py-3">
                <p className="text-sm font-semibold">{t.display_name}</p>
                <p className="text-sm text-label-2">
                  {t.members_assigned > 0 ? (
                    <Link href={`/gym?trainer=${t.trainer_id}`} className="text-link">
                      {count(t.members_assigned, "member")}
                    </Link>
                  ) : (
                    count(t.members_assigned, "member")
                  )}{" "}
                  · {count(t.plans_this_week, "plan")} for this week
                </p>
                {t.members_inactive_7_days > 0 && (
                  <p className="text-xs text-orange">{t.members_inactive_7_days} not training in the last 7 days</p>
                )}
              </div>
              <RemoveButton
                label="Remove from gym"
                warning={`${
                  t.members_assigned > 0
                    ? `${t.display_name} will stop training ${count(t.members_assigned, "member")} here.`
                    : `${t.display_name} will leave ${gym.name}.`
                } Your trainer invite link stops working, so make a new one for trainers who haven't joined yet.`}
                action={removeStaff.bind(null, gym.id, t.trainer_id, "trainer")}
                subtle
              />
            </li>
          ))}
        </ul>
      )}

      {gym.isOwner && (
        <>
          <h2 className="section-title mt-8">Admins</h2>
          {admins.length === 0 ? (
            <p className="px-1 text-sm text-label-2">
              Only you run {gym.name}.{" "}
              <Link href="/gym/invite" className="text-link">
                Add an admin
              </Link>
            </p>
          ) : (
            <ul className="card divide-y divide-separator">
              {admins.map((a) => (
                <li key={a.user_id}>
                  <p className="px-4 pt-3 text-sm font-semibold">{joinName(a.first_name, a.last_name) || "Admin"}</p>
                  <RemoveButton
                    label={a.user_id === user?.id ? "Step down" : "Remove admin"}
                    warning={`${joinName(a.first_name, a.last_name) || "They"} will no longer run ${gym.name}.`}
                    action={removeStaff.bind(null, gym.id, a.user_id, "admin")}
                  />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </main>
  );
}
