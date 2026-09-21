import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone, todayIn } from "@/lib/date";

// The person's own timezone and "today". Every server-side "today" goes through here so a workout
// logged at 1 AM in India is dated in India, not in whatever timezone the server runs in.
//
// The timezone lives on the profile (set from the person's device — see TimezoneSync). Until it is
// known — a new account, or the column not migrated yet — this falls back to the server's local
// date, which is what the app did before per-user timezones.

export type UserTimeZone = {
  signedIn: boolean;
  timeZone: string | null;
};

// Cached per request so a page and its queries share one lookup.
export const getUserTimeZone = cache(async (): Promise<UserTimeZone> => {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { signedIn: false, timeZone: null };

    // A failed lookup (e.g. the timezone column not migrated yet) is not fatal: the caller falls back.
    const { data } = await supabase.from("profiles").select("timezone").eq("id", user.id).maybeSingle();
    const stored = (data as { timezone?: string | null } | null)?.timezone ?? null;
    return { signedIn: true, timeZone: stored && isValidTimeZone(stored) ? stored : null };
  } catch {
    return { signedIn: false, timeZone: null };
  }
});

export async function getToday(): Promise<string> {
  const { timeZone } = await getUserTimeZone();
  return todayIn(timeZone);
}
