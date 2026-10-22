import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { createClient } from "@/lib/supabase/server";
import { getMyTrainer } from "@/lib/trainers";
import JoinActions from "./JoinActions";

export const metadata: Metadata = { title: "Join your trainer" };

type InviteDetails = {
  state: "valid" | "expired" | "not_found" | "own" | "current";
  display_name: string | null;
  gym_name: string | null;
  city: string | null;
};

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const [{ data }, current] = await Promise.all([
    supabase.rpc("trainer_invite_details", { p_code: code }),
    getMyTrainer(),
  ]);
  const details = (data as InviteDetails[] | null)?.[0];
  const name = details?.display_name ?? "your trainer";

  if (!details || details.state === "not_found" || details.state === "expired") {
    return (
      <Message
        title={details?.state === "expired" ? "This invite link has expired" : "This invite link doesn't work"}
        text="Ask your trainer to send you a new one."
      />
    );
  }
  if (details.state === "own") {
    return <Message title="This is your invite link" text="Send it to your clients." link={{ href: "/trainer/invite", label: "Invite a client" }} />;
  }
  if (details.state === "current") {
    return <Message title={`You're already training with ${name}`} />;
  }

  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title={`Train with ${name}`}
        subtitle={[details.gym_name, details.city].filter(Boolean).join(" · ") || undefined}
      />
      <div className="flex max-w-md flex-col gap-4">
        <section className="card p-4 text-sm">
          <h2 className="font-semibold">{name} will see</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-label-2">
            <li>Your workout plans, and can plan workouts for you</li>
            <li>Your logged workouts, including notes</li>
            <li>Your body weight</li>
            <li>Your name, goal, experience and training days</li>
          </ul>
          <h2 className="mt-4 font-semibold">{name} won&apos;t see</h2>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-label-2">
            <li>Your email, date of birth, height or gender</li>
            <li>Coach, AI plans or meals</li>
          </ul>
        </section>

        <p className="text-sm text-label-2">
          {current && `You'll stop training with ${current.trainer.display_name}. `}
          You can remove {name} anytime from Profile.
        </p>
        <JoinActions code={code} />
      </div>
    </main>
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
