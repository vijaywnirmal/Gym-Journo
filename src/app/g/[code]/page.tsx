import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getMyGymMembership, getTrainerLinkGymId } from "@/lib/gyms";
import { getMyTrainer } from "@/lib/trainers";
import type { GymRole } from "@/lib/types";
import GymJoinActions from "./GymJoinActions";

export const metadata: Metadata = { title: "Join a gym" };

type InviteDetails = {
  state: "valid" | "expired" | "not_found" | "current" | "own" | "needs_trainer_profile";
  role: GymRole | null;
  gym_name: string | null;
  city: string | null;
  area: string | null;
};

const CURRENT: Record<GymRole, (gym: string) => string> = {
  member: (gym) => `You're a member of ${gym}`,
  trainer: (gym) => `You're a trainer at ${gym}`,
  admin: (gym) => `You help run ${gym}`,
};

export default async function GymJoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const [{ data, error }, membership, myTrainer] = await Promise.all([
    supabase.rpc("gym_invite_details", { p_code: code }),
    getMyGymMembership(),
    getMyTrainer(),
  ]);
  const details = (data as InviteDetails[] | null)?.[0];

  if (error) {
    return <Message title="Couldn't open this invite" text="Please try again in a moment." />;
  }
  if (!details || !details.role || !details.gym_name || details.state === "not_found" || details.state === "expired") {
    return (
      <Message
        title={details?.state === "expired" ? "This invite link has expired" : "This invite link doesn't work"}
        text="Ask the gym for a new one."
      />
    );
  }
  const gym = details.gym_name;
  const role = details.role;
  if (details.state === "own") {
    return (
      <Message
        title="This is your gym's admin link"
        text="Send it to the person who'll help you run the gym. It works for one person."
        link={{ href: "/gym/invite", label: "Invite people" }}
      />
    );
  }
  if (details.state === "current") {
    return (
      <Message
        title={CURRENT[role](gym)}
        link={role === "admin" ? { href: "/gym", label: "Go to your gym" } : role === "trainer" ? { href: "/trainer", label: "Go to Clients" } : undefined}
      />
    );
  }
  const place = [details.area, details.city].filter(Boolean).join(", ") || undefined;
  // A member switching gyms also loses the trainer their old gym arranged.
  const leavingTrainer =
    role === "member" && membership && myTrainer && (await getTrainerLinkGymId(myTrainer.linkId)) === membership.gym.id
      ? myTrainer.trainer.display_name
      : null;
  if (details.state === "needs_trainer_profile") {
    return (
      <Message
        title={`Train at ${gym}`}
        text="Set up your trainer account first."
        link={{ href: `/trainer/setup?next=/g/${encodeURIComponent(code)}`, label: "Set up a trainer account" }}
      />
    );
  }

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader title={role === "member" ? `Join ${gym}` : role === "trainer" ? `Train at ${gym}` : `Help run ${gym}`} subtitle={place} />
      <div className="flex max-w-md flex-col gap-4">
        {role === "member" && (
          <Consent
            sees={["Your name", "How many workouts you log each week, and when you last trained", "Whether you have a trainer"]}
            doesntSee={["Your plans, sets, notes or body weight", "Your email or other profile details"]}
            gym={gym}
          >
            {gym} may suggest a trainer. You choose whether to accept, and only then do they see your plans, workouts and body weight.
          </Consent>
        )}
        {role === "trainer" && (
          <Consent
            sees={["Your name", "How many of its members you train", "How many plans you've made for them this week"]}
            doesntSee={["Your other clients", "Your own workouts"]}
            gym={gym}
          >
            {gym} can suggest you to its members as their trainer.
          </Consent>
        )}
        {role === "admin" && (
          <section className="card p-4 text-sm">
            <h2 className="font-semibold">You&apos;ll be able to</h2>
            <ul className="mt-1.5 list-disc space-y-1 pl-5 text-label-2">
              <li>Invite trainers and members</li>
              <li>Suggest trainers to members</li>
              <li>See members&apos; names, workouts each week and last workout</li>
            </ul>
          </section>
        )}

        <p className="text-sm text-label-2">
          {role === "member" &&
            membership &&
            (leavingTrainer
              ? `You'll leave ${membership.gym.name}, and ${leavingTrainer} will stop training you. `
              : `You'll leave ${membership.gym.name}. `)}
          You can leave anytime from Profile.{" "}
          <Link href="/privacy" className="text-link">
            Privacy policy
          </Link>
        </p>
        <GymJoinActions code={code} label={`Join ${gym}`} />
      </div>
    </main>
  );
}

function Consent({ gym, sees, doesntSee, children }: { gym: string; sees: string[]; doesntSee: string[]; children: React.ReactNode }) {
  return (
    <section className="card p-4 text-sm">
      <h2 className="font-semibold">{gym} will see</h2>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-label-2">
        {sees.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <h2 className="mt-4 font-semibold">{gym} won&apos;t see</h2>
      <ul className="mt-1.5 list-disc space-y-1 pl-5 text-label-2">
        {doesntSee.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      <p className="mt-4 text-label-2">{children}</p>
    </section>
  );
}

function Message({ title, text, link = { href: "/", label: "Go to Today" } }: {
  title: string;
  text?: string;
  link?: { href: string; label: string };
}) {
  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader title={title} subtitle={text} />
      <Link href={link.href} className="text-sm font-semibold text-link">
        {link.label}
      </Link>
    </main>
  );
}
