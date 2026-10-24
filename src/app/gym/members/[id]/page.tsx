import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { formatDateLong, todayIn } from "@/lib/date";
import { getUserTimeZone } from "@/lib/userDate";
import { getAdminGym, getGymMembers, getGymTrainers } from "@/lib/gyms";
import { isQuiet, lastWorkoutLabel, memberName } from "@/lib/gymStatus";
import { removeMember, suggestTrainer, unassignTrainer } from "../../actions";
import MemberTrainerCard from "./MemberTrainerCard";
import RemoveButton from "@/components/RemoveButton";

export const metadata: Metadata = { title: "Member" };

export default async function GymMemberPage({ params }: PageProps<"/gym/members/[id]">) {
  const { id } = await params;
  const gym = await getAdminGym();
  if (!gym) redirect("/gym/setup");
  const [members, trainers, { timeZone }] = await Promise.all([getGymMembers(gym.id), getGymTrainers(gym.id), getUserTimeZone()]);
  const member = members.find((m) => m.member_id === id);
  if (!member) notFound();
  const name = memberName(member);
  const firstName = member.first_name || name;

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title={name}
        subtitle={`Joined ${formatDateLong(todayIn(timeZone, new Date(member.joined_at)))}`}
        back={{ href: "/gym", label: "Members" }}
      />
      <div className="flex max-w-md flex-col gap-6">
        <section className="card grid grid-cols-2 divide-x divide-separator">
          <div className="px-4 py-3">
            <p className="text-xl font-semibold tabular-nums">{member.workouts_this_week}</p>
            <p className="text-xs text-label-2">Workouts this week</p>
          </div>
          <div className="px-4 py-3">
            <p className={`text-sm font-semibold ${isQuiet(member) ? "text-orange" : ""}`}>{lastWorkoutLabel(member)}</p>
          </div>
        </section>

        <div>
          <h2 className="section-title">Trainer</h2>
          {member.has_own_trainer ? (
            <section className="card px-4 py-3 text-sm text-label-2">{firstName} has their own trainer.</section>
          ) : trainers.length === 0 ? (
            <section className="card px-4 py-3 text-sm">
              <p className="text-label-2">No trainers at your gym yet.</p>
              <Link href="/gym/invite" className="mt-1 inline-block font-semibold text-link">
                Invite a trainer
              </Link>
            </section>
          ) : (
            <MemberTrainerCard
              firstName={firstName}
              trainers={trainers
                .filter((t) => t.trainer_id !== member.member_id)
                .map((t) => ({ id: t.trainer_id, name: t.display_name }))}
              current={member.trainer_id && member.trainer_name ? { id: member.trainer_id, name: member.trainer_name } : null}
              offered={
                member.offered_trainer_id && member.offered_trainer_name
                  ? { id: member.offered_trainer_id, name: member.offered_trainer_name }
                  : null
              }
              declined={
                member.declined_trainer_id && member.declined_trainer_name
                  ? { id: member.declined_trainer_id, name: member.declined_trainer_name }
                  : null
              }
              suggest={suggestTrainer.bind(null, gym.id, member.member_id)}
              unassign={unassignTrainer.bind(null, gym.id, member.member_id)}
            />
          )}
        </div>

        <section className="card">
          <RemoveButton
            label="Remove from gym"
            warning={
              member.trainer_name
                ? `${firstName} will leave ${gym.name}, and ${member.trainer_name} will stop training them.`
                : `${firstName} will leave ${gym.name}.`
            }
            action={removeMember.bind(null, gym.id, member.member_id)}
            done="/gym"
          />
        </section>
      </div>
    </main>
  );
}
