"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { COACH_CONSENT } from "@/lib/coach/consent";
import { formatDateLong } from "@/lib/date";
import { setCoachConsent } from "./actions";

// Where a person gives (and withdraws) consent for Coach to use their training data. Consent is
// off until they turn it on here, and the server checks it again on every Coach question.
export default function CoachConsentSection({ consentedAt }: { consentedAt: string | null }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const consented = consentedAt !== null;

  function change(enabled: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await setCoachConsent(enabled);
      if (result.error) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <section className="mt-5 rounded-xl bg-surface p-4">
      <h2 className="mb-1 text-base font-semibold text-label">Coach</h2>
      <p className="mb-3 text-xs text-label-2">{COACH_CONSENT.summary}</p>

      <p className="mb-1 text-xs font-medium text-label">What is sent</p>
      <ul className="mb-3 list-disc pl-5 text-xs text-label-2">
        {COACH_CONSENT.shared.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p className="mb-1 text-xs font-medium text-label">What is not sent</p>
      <ul className="mb-3 list-disc pl-5 text-xs text-label-2">
        {COACH_CONSENT.notShared.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>

      <p className="mb-2 text-xs text-label-2">{COACH_CONSENT.dataUse}</p>
      <p className="mb-2 text-xs text-label-2">{COACH_CONSENT.kept}</p>
      <p className="mb-2 text-xs text-label-2">{COACH_CONSENT.withdraw}</p>
      <p className="mb-3 text-xs text-label-2">{COACH_CONSENT.limits}</p>

      {consented ? (
        <div className="flex flex-wrap items-center gap-3">
          <p className="text-xs text-green">
            Allowed since {formatDateLong(consentedAt.slice(0, 10))}
          </p>
          <Link href="/coach" className="text-xs text-tint">
            Open Coach
          </Link>
          <button
            type="button"
            onClick={() => change(false)}
            disabled={pending}
            className="ml-auto rounded-lg bg-fill px-3 py-1.5 text-xs font-medium text-label disabled:opacity-50"
          >
            Withdraw consent
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => change(true)}
          disabled={pending}
          className="rounded-lg bg-tint px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
        >
          Allow Coach to use my training data
        </button>
      )}

      {error && <p className="mt-2 text-xs text-red">{error}</p>}
    </section>
  );
}
