// When the browser should tell the server its timezone. Pure so it can be tested without a DOM.

export type SyncOutcome = "updated" | "no_profile" | "failed";

// The zone's clock through the coming year, sampled twice a month. Null for a zone this browser
// doesn't know.
function clockOverAYear(zone: string): string | null {
  try {
    const format = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" });
    const year = new Date().getUTCFullYear();
    return Array.from({ length: 24 }, (_, i) => format.format(Date.UTC(year, i / 2, i % 2 ? 15 : 1))).join();
  } catch {
    return null;
  }
}

// The same zone can have several names (Asia/Calcutta and Asia/Kolkata), and browsers disagree on
// which they report: Safari no longer maps them to one name. So zones are compared by their clocks.
// Zones that keep the same time (Paris and Berlin) count as one too, which is all "today" depends on.
export function sameTimeZone(a: string, b: string): boolean {
  if (a === b) return true;
  const clock = clockOverAYear(a);
  return clock !== null && clock === clockOverAYear(b);
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
