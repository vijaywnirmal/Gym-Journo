import type { Metadata } from "next";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = { title: "Invite link" };

// Where someone not signed in lands from a link that no longer works (see endedInvitePath), before
// they create an account for nothing. Says nothing about who sent it: that stays behind sign-in.
export default async function InviteEndedPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; state?: string }>;
}) {
  const { from, state } = await searchParams;
  return (
    <main className="px-4 pt-6 pb-10 md:px-8 md:pt-10">
      <PageHeader
        title={state === "expired" ? "This invite link has expired" : "This invite link doesn't work"}
        subtitle={from === "gym" ? "Ask the gym for a new one." : "Ask your trainer to send you a new one."}
      />
      <Link href="/login" className="inline-block py-1 text-sm font-semibold text-link">
        Go to sign in
      </Link>
    </main>
  );
}
