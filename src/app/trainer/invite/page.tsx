import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PageHeader from "@/components/PageHeader";
import { format, parseISO } from "date-fns";
import { getSiteUrl } from "@/lib/siteUrl";
import { todayIn } from "@/lib/date";
import { getUserTimeZone } from "@/lib/userDate";
import { getCurrentInvite, getMyTrainerProfile } from "@/lib/trainers";
import { inviteUrl } from "@/lib/trainerInvites";
import InviteLinkCard from "@/components/InviteLinkCard";
import { createInviteLink } from "./actions";

export const metadata: Metadata = { title: "Invite a client" };

export default async function TrainerInvitePage() {
  const trainer = await getMyTrainerProfile();
  if (!trainer) redirect("/trainer/setup");
  const [invite, siteUrl, { timeZone }] = await Promise.all([getCurrentInvite(), getSiteUrl(), getUserTimeZone()]);

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title="Invite a client"
        subtitle="Clients join you by opening this link."
        back={{ href: "/trainer", label: "Clients" }}
      />
      <div className="max-w-md">
        <InviteLinkCard
          invite={
            invite && {
              url: inviteUrl(siteUrl, invite.code),
              expiresOn: format(parseISO(todayIn(timeZone, new Date(invite.expires_at))), "MMM d"),
            }
          }
          makeLink={createInviteLink}
          shareText="Join me on Gym Journal:"
        />
      </div>
    </main>
  );
}
