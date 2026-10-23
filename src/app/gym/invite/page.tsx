import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { format, parseISO } from "date-fns";
import PageHeader from "@/components/PageHeader";
import InviteLinkCard from "@/components/InviteLinkCard";
import { getSiteUrl } from "@/lib/siteUrl";
import { todayIn } from "@/lib/date";
import { getUserTimeZone } from "@/lib/userDate";
import { getAdminGym, getGymInvites } from "@/lib/gyms";
import { gymInviteUrl } from "@/lib/trainerInvites";
import type { GymRole } from "@/lib/types";
import { createGymInviteLink } from "./actions";

export const metadata: Metadata = { title: "Invite people" };

export default async function GymInvitePage() {
  const gym = await getAdminGym();
  if (!gym) redirect("/gym/setup");
  const [invites, siteUrl, { timeZone }] = await Promise.all([getGymInvites(gym.id), getSiteUrl(), getUserTimeZone()]);

  function invite(role: GymRole) {
    const current = invites[role];
    return current
      ? {
          url: gymInviteUrl(siteUrl, current.code, role),
          expiresOn: current.expires_at ? format(parseISO(todayIn(timeZone, new Date(current.expires_at))), "MMM d") : null,
        }
      : null;
  }

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader title="Invite people" subtitle={gym.name} back={{ href: "/gym", label: "Members" }} />
      <div className="flex max-w-md flex-col">
        <h2 className="section-title">Members</h2>
        <p className="mb-2 text-sm text-label-2">Members join by scanning the poster at your front desk.</p>
        <InviteLinkCard
          invite={invite("member")}
          makeLink={createGymInviteLink.bind(null, gym.id, "member")}
          shareText={`Join ${gym.name} on Gym Journal:`}
          replaceWarning="Your current link and poster will stop working."
        >
          {invites.member && (
            <Link
              href="/gym/poster"
              className="flex h-10 items-center rounded-[10px] border border-separator px-4 text-sm font-semibold hover:bg-fill"
            >
              Print poster
            </Link>
          )}
        </InviteLinkCard>

        <h2 className="section-title mt-8">Trainers</h2>
        <p className="mb-2 text-sm text-label-2">Send this to your trainers.</p>
        <InviteLinkCard
          invite={invite("trainer")}
          makeLink={createGymInviteLink.bind(null, gym.id, "trainer")}
          shareText={`Join ${gym.name} as a trainer on Gym Journal:`}
        />

        {gym.isOwner && (
          <>
            <h2 className="section-title mt-8">Admins</h2>
            <p className="mb-2 text-sm text-label-2">Admins can invite people and suggest trainers to members.</p>
            <InviteLinkCard
              invite={invite("admin")}
              makeLink={createGymInviteLink.bind(null, gym.id, "admin")}
              shareText={`Help run ${gym.name} on Gym Journal:`}
              singleUse
            />
          </>
        )}
      </div>
    </main>
  );
}
