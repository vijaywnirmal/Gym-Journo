"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { syncTimezone } from "@/app/timezone/actions";
import { isDefinitiveOutcome, shouldSyncTimeZone } from "@/lib/timezoneSync";

const ATTEMPT_KEY = "gym-journo-tz-attempt";

function readAttempt(): string | null {
  try {
    return sessionStorage.getItem(ATTEMPT_KEY);
  } catch {
    return null;
  }
}

function writeAttempt(timeZone: string) {
  try {
    sessionStorage.setItem(ATTEMPT_KEY, timeZone);
  } catch {
    // Private mode etc. — worst case it tries again on the next page load.
  }
}

// Renders nothing. Tells the server this device's timezone when it differs from the stored one, then
// refreshes so the page that was just drawn with the fallback "today" is drawn with the right one.
export default function TimezoneSync({ stored }: { stored: string | null }) {
  const router = useRouter();

  useEffect(() => {
    const browser = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
    if (!shouldSyncTimeZone({ stored, browser, attemptedThisSession: readAttempt() }) || !browser) return;

    let cancelled = false;
    syncTimezone(browser)
      .then(({ outcome }) => {
        if (isDefinitiveOutcome(outcome)) writeAttempt(browser);
        if (outcome === "updated" && !cancelled) router.refresh();
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [stored, router]);

  return null;
}
