import { createAdminClient } from "@/lib/supabase/admin";
import { deliver, pushConfigFromEnv, webPushTransport, type StoredSubscription } from "./send";
import type { PushPayload } from "./reminderMessage";

// Sends a notification to every device someone turned notifications on for, and forgets devices
// the push service says are gone. For one person to notify another (a trainer's plan reaching their
// client), so it reads the subscriptions with the service role: call it only after the database has
// confirmed the right to (e.g. save_client_plan succeeded). Never throws; a failed notification
// mustn't fail what triggered it.
export async function notifyUser(userId: string, payload: PushPayload): Promise<void> {
  const config = pushConfigFromEnv();
  const admin = createAdminClient();
  if (!config || !admin) return;
  try {
    const { data, error } = await admin
      .from("push_subscriptions")
      .select("endpoint, p256dh, auth")
      .eq("user_id", userId);
    if (error || !data || data.length === 0) return;
    const result = await deliver(data as StoredSubscription[], payload, webPushTransport(config));
    if (result.expired.length > 0) {
      await admin.from("push_subscriptions").delete().eq("user_id", userId).in("endpoint", result.expired);
    }
  } catch (error) {
    console.error("Couldn't send a notification", error);
  }
}
