"use server";

import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone } from "@/lib/date";
import type { SyncOutcome } from "@/lib/timezoneSync";

// Stores the device's timezone on the signed-in person's profile. Best effort: a failure (or a
// profile that doesn't exist yet) never surfaces to the person — "today" just keeps using the
// fallback until a later page load succeeds.
export async function syncTimezone(timeZone: string): Promise<{ outcome: SyncOutcome }> {
  if (!isValidTimeZone(timeZone)) return { outcome: "failed" };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { outcome: "no_profile" };

  const { data, error } = await supabase
    .from("profiles")
    .update({ timezone: timeZone })
    .eq("id", user.id)
    .select("id");

  if (error) return { outcome: "failed" };
  return { outcome: data && data.length > 0 ? "updated" : "no_profile" };
}
