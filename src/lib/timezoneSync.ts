// When the browser should tell the server its timezone. Pure so it can be tested without a DOM.

export type SyncOutcome = "updated" | "no_profile" | "failed";

// Sync when the stored timezone differs from the device's and this session hasn't already tried
// that same timezone. A session flag is set only for a definite outcome — "no_profile" (the profile
// row doesn't exist yet, e.g. mid-onboarding) is retried on the next page load.
export function shouldSyncTimeZone(args: {
  stored: string | null;
  browser: string | null;
  attemptedThisSession: string | null;
}): boolean {
  const { stored, browser, attemptedThisSession } = args;
  if (!browser) return false;
  if (stored === browser) return false;
  return attemptedThisSession !== browser;
}

export function isDefinitiveOutcome(outcome: SyncOutcome): boolean {
  return outcome !== "no_profile";
}
