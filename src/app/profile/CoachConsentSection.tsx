"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { COACH_CONSENT } from "@/lib/coach/consent";
import { formatDateLong } from "@/lib/date";
import Disclosure from "@/components/ui/Disclosure";
import Icon from "@/components/Icon";
import { setCoachConsent } from "./actions";

// The full notice, shown on request: what is sent, what isn't, and what happens to it.
function ConsentDetails() {
  return (
    <div className="flex flex-col gap-3 pt-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <p className="mb-1 text-xs font-semibold text-label-2">Sent with each question</p>
          <ul className="flex flex-col gap-1">
            {COACH_CONSENT.shared.map((item) => (
              <li key={item} className="flex gap-2 text-label-2">
                <Icon name="checkmark" className="mt-0.5 size-3.5 shrink-0 text-green" strokeWidth={2.5} />
                {item}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-label-2">Never sent</p>
          <ul className="flex flex-col gap-1">
            {COACH_CONSENT.notShared.map((item) => (
              <li key={item} className="flex gap-2 text-label-2">
                <Icon name="close" className="mt-0.5 size-3.5 shrink-0 text-label-3" strokeWidth={2.5} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="text-xs leading-relaxed text-label-3">
        {COACH_CONSENT.dataUse} {COACH_CONSENT.kept} {COACH_CONSENT.withdraw} {COACH_CONSENT.limits}
      </p>
    </div>
  );
}

function useConsentChange() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

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

  return { pending, error, change };
}

// Profile setting: a single row with the current state, the notice one tap away, and on/off.
// Consent is off until the person turns it on, and the server checks it on every Coach question.
export default function CoachConsentSection({
  consentedAt,
  timeZone = null,
}: {
  consentedAt: string | null;
  // The profile's zone, so the consent day is the person's own, not UTC's.
  timeZone?: string | null;
}) {
  const { pending, error, change } = useConsentChange();
  const consented = consentedAt !== null;

  return (
    <section className="card p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent/10 text-link">
          <Icon name="compass" className="size-[18px]" strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            Coach
            <span
              className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                consented ? "bg-green/12 text-green" : "bg-fill text-label-2"
              }`}
            >
              {consented ? "On" : "Off"}
            </span>
          </h2>
          <p className="text-sm text-label-2">
            {consented
              ? `Allowed since ${formatDateLong(new Date(consentedAt).toLocaleDateString("en-CA", { timeZone: timeZone ?? "UTC" }))}. Your training data is sent to Google's Gemini model when you ask a question.`
              : COACH_CONSENT.summary}
          </p>
        </div>
      </div>

      <div className="ml-12">
        <Disclosure
          className="mt-1"
          summary={<span className="text-sm font-medium text-link">What&apos;s shared and what isn&apos;t</span>}
          summaryClassName="h-8"
        >
          <ConsentDetails />
        </Disclosure>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {consented ? (
            <>
              <Link
                href="/coach"
                className="flex h-8 items-center rounded-lg bg-accent px-3 text-sm font-semibold text-on-accent hover:bg-accent-hover"
              >
                Open Coach
              </Link>
              <button
                type="button"
                onClick={() => change(false)}
                disabled={pending}
                className="h-8 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill disabled:opacity-50"
              >
                {pending ? "Saving…" : "Withdraw consent"}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => change(true)}
              disabled={pending}
              className="h-9 rounded-lg bg-accent px-3.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
            >
              {pending ? "Saving…" : "Allow Coach to use my training data"}
            </button>
          )}
        </div>
        {error && <p className="mt-2 text-sm text-red">{error}</p>}
      </div>
    </section>
  );
}

// Shown on the Coach page before consent: asked at the moment it's needed, with the full notice
// available inline.
export function CoachConsentPrompt() {
  const { pending, error, change } = useConsentChange();

  return (
    <section className="card p-5">
      <h2 className="text-base font-semibold">Allow Coach to read your training data?</h2>
      <p className="mt-1 text-sm text-label-2">{COACH_CONSENT.summary}</p>
      <Disclosure
        className="mt-2"
        summary={<span className="text-sm font-medium text-link">What&apos;s shared and what isn&apos;t</span>}
        summaryClassName="h-8"
      >
        <ConsentDetails />
      </Disclosure>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => change(true)}
          disabled={pending}
          className="h-10 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
        >
          {pending ? "Saving…" : "Allow Coach to use my training data"}
        </button>
        <p className="text-xs text-label-3">You can turn this off any time in Profile.</p>
      </div>
      {error && <p className="mt-2 text-sm text-red">{error}</p>}
    </section>
  );
}
