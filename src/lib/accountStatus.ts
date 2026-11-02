// Where a disabled account lands after signing in (see src/lib/supabase/middleware.ts).
export const ACCOUNT_DISABLED_PATH = "/account-disabled";

// Set once this browser's signed-in person is known to be onboarded and not disabled, holding their
// user id, so the proxy doesn't query the profile on every request (each query was a round trip to
// the database, prefetches included). Only ever skips the check for that same user, and is cleared
// on signing in, so a disabled account is noticed on a browser that had it from before.
export const ONBOARDED_COOKIE = "gj-onboarded";
