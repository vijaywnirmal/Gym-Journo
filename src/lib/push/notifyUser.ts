import { createAdminClient } from "@/lib/supabase/admin";
import { deliver, pushConfigFromEnv, webPushTransport, type StoredSubscription } from "./send";
import type { PushPayload } from "./reminderMessage";

// Someone saving plan after plan could otherwise buzz a client's phone every time. Per kind of
// notification, so a change to today still gets through after one about a later day.
const MIN_GAP = "10 minutes";

// Sends a notification to every device someone turned notifications on for, and forgets devices
// the push service says are gone. Only while their notifications setting is on: turning it off on
// one device leaves other devices subscribed. For one person to notify another (a trainer's plan
// reaching their client), so it reads with the service role: call it only after the database has
// confirmed the right to (e.g. save_client_plan succeeded). Never throws; a failed notification
// mustn't fail what triggered it.
export async function notifyUser(userId: string, payload: PushPayload): Promise<void> {
  const config = pushConfigFromEnv();
  const admin = createAdminClient();
  if (!config || !admin) return;
  try {
    const { data: profile } = await admin.from("profiles").select("workout_reminders").eq("id", userId).maybeSingle();
    if (profile?.workout_reminders !== true) return;
    const { data, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error || !data || data.length === 0) return;
    const { data: claimed } = await admin.rpc("claim_notification", {
      p_user_id: userId,
      p_topic: payload.tag,
      p_min_gap: MIN_GAP,
    });
    // Only a clear no holds it back: if the check itself fails, the message still matters more.
    if (claimed === false) return;
    const result = await deliver(data as StoredSubscription[], payload, webPushTransport(config));
    if (result.expired.length > 0) {
      await admin.from("push_subscriptions").delete().eq("user_id", userId).in("endpoint", result.expired);
    }
  } catch (error) {
    console.error("Couldn't send a notification", error);
  }
}
