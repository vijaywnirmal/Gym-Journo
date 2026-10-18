import Link from "next/link";
import { getProfile } from "@/lib/queries";
import { hasCoachConsent } from "@/lib/coach/consent";
import CoachChat from "./CoachChat";
import BackLink from "@/components/BackLink";

export default async function CoachPage() {
  const profile = await getProfile();
  const consented = hasCoachConsent(profile);

  return (
    <main className="screen-enter px-4 pt-4 pb-10">
      <BackLink href="/" label="Today" />
      <h1 className="mb-1 large-title">Coach</h1>
      <p className="mb-5 text-sm text-label-2">
        Coach explains what your training records show. It doesn&apos;t give advice, and it can&apos;t
        help with pain or injuries.
      </p>

      {consented ? (
        <CoachChat />
      ) : (
        <div className="rounded-xl bg-surface p-4">
          <p className="mb-3 text-sm text-label">
            To ask Coach a question, your training data is sent to Google&apos;s Gemini model. You
            choose whether to allow that, and you can withdraw at any time.
          </p>
          <Link
            href="/profile"
            className="inline-block rounded-lg bg-tint px-4 py-2.5 text-sm font-medium text-white"
          >
            Review and allow in Profile
          </Link>
        </div>
      )}
    </main>
  );
}
