// When the browser should tell the server its timezone. Pure so it can be tested without a DOM.

export type SyncOutcome = "updated" | "no_profile" | "failed";

// The same zone can have several names (Asia/Calcutta and Asia/Kolkata); the browser's Intl data
// maps each to one canonical name, so two names count as one zone when they resolve alike.
export function canonicalTimeZone(zone: string): string {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: zone }).resolvedOptions().timeZone;
  } catch {
    return zone;
  }
}

export function sameTimeZone(a: string, b: string): boolean {
  return a === b || canonicalTimeZone(a) === canonicalTimeZone(b);
}

// What to do about this device's timezone:
// - "sync": nothing is stored yet, so store it without asking (a new account's first visit);
// - "ask": a different zone is stored — the person may be travelling, or this is a second device in
//   another zone — so ask before changing the account (silently writing it made two devices flip the
//   account back and forth);
// - "none": they match, the device reports nothing, this session already tried this zone, or the
//   person chose to keep the account's zone on this device.
// A session flag is set only for a definite outcome — "no_profile" (the profile row doesn't exist
// yet, e.g. mid-onboarding) is retried on the next page load.
export function timeZoneAction(args: {
  stored: string | null;
  browser: string | null;
  attemptedThisSession: string | null;
  keptOnThisDevice: string | null;
}): "sync" | "ask" | "none" {
  const { stored, browser, attemptedThisSession, keptOnThisDevice } = args;
  if (!browser) return "none";
  if (stored && sameTimeZone(stored, browser)) return "none";
  if (attemptedThisSession === browser) return "none";
  if (!stored) return "sync";
  if (keptOnThisDevice === browser) return "none";
  return "ask";
}

export function isDefinitiveOutcome(outcome: SyncOutcome): boolean {
  return outcome !== "no_profile";
}
