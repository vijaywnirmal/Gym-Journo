import Link from "next/link";
import { getProfile } from "@/lib/queries";
import { hasCoachConsent } from "@/lib/coach/consent";
import CoachChat from "./CoachChat";

export default async function CoachPage() {
  const profile = await getProfile();
  const consented = hasCoachConsent(profile);

  return (
    <main className="px-4 pt-6 pb-10">
      <Link href="/" className="mb-1 inline-block text-sm text-neutral-500">
        ← Home
      </Link>
      <h1 className="mb-1 text-xl font-bold text-neutral-100">Coach</h1>
      <p className="mb-5 text-sm text-neutral-400">
        Coach explains what your training records show. It doesn&apos;t give advice, and it can&apos;t
        help with pain or injuries.
      </p>

      {consented ? (
        <CoachChat />
      ) : (
        <div className="rounded-xl border border-dashed border-neutral-700 p-4">
          <p className="mb-3 text-sm text-neutral-300">
            To ask Coach a question, your training data is sent to Google&apos;s Gemini model. You
            choose whether to allow that, and you can withdraw at any time.
          </p>
          <Link
            href="/profile"
            className="inline-block rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-neutral-900"
          >
            Review and allow in Profile
          </Link>
        </div>
      )}
    </main>
  );
}
