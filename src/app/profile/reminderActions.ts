"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { TEST_NOTIFICATION } from "@/lib/push/reminderMessage";
import { deliver, pushConfigFromEnv, webPushTransport, type StoredSubscription } from "@/lib/push/send";

// Workout reminder settings and this device's push subscription. Every action checks the signed-in
// person itself (Server Functions are reachable directly) and validates its input.

const subscriptionSchema = z.object({
  endpoint: z.url().startsWith("https://").max(2000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  // Local time of day, HH:MM (24h).
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

type Result = { success: true } | { error: string };

async function signedIn() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

// Saves this browser's push subscription (PushSubscription.toJSON()) for the signed-in person.
export async function savePushSubscription(subscription: unknown, userAgent: string): Promise<Result> {
  const session = await signedIn();
  if (!session) return { error: "Not signed in" };
  const parsed = subscriptionSchema.safeParse(subscription);
  if (!parsed.success) return { error: "This browser returned an invalid subscription." };

  const { error } = await session.supabase.rpc("register_push_subscription", {
    p_endpoint: parsed.data.endpoint,
    p_p256dh: parsed.data.keys.p256dh,
    p_auth: parsed.data.keys.auth,
    p_user_agent: userAgent.slice(0, 500),
  });
  return error ? { error: "Couldn't save this device. Please try again." } : { success: true };
}

// Forgets this browser's subscription (after it unsubscribes).
export async function removePushSubscription(endpoint: string): Promise<Result> {
  const session = await signedIn();
  if (!session) return { error: "Not signed in" };
  const { error } = await session.supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return error ? { error: "Couldn't remove this device. Please try again." } : { success: true };
}

export async function updateReminderSettings(input: { enabled: boolean; time: string }): Promise<Result> {
  const session = await signedIn();
  if (!session) return { error: "Not signed in" };
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { error: "Choose a valid reminder time." };

  const { data, error } = await session.supabase
    .from("profiles")
    .update({ workout_reminders: parsed.data.enabled, reminder_time: parsed.data.time })
    .eq("id", session.userId)
    .select("id");
  if (error || !data || data.length === 0) return { error: "Couldn't save your reminder settings. Please try again." };

  revalidatePath("/profile");
  return { success: true };
}

// Sends a sample notification to every device of the signed-in person.
export async function sendTestNotification(): Promise<{ delivered: number } | { error: string }> {
  const session = await signedIn();
  if (!session) return { error: "Not signed in" };
  const config = pushConfigFromEnv();
  if (!config) return { error: "Notifications aren't set up on this server." };

  const { data, error } = await session.supabase.from("push_subscriptions").select("endpoint, p256dh, auth");
  if (error) return { error: "Couldn't load your devices. Please try again." };
  if (!data || data.length === 0) return { error: "No device is set up for notifications yet." };

  const result = await deliver(data as StoredSubscription[], TEST_NOTIFICATION, webPushTransport(config));
  if (result.expired.length > 0) {
    await session.supabase.from("push_subscriptions").delete().in("endpoint", result.expired);
  }
  if (result.delivered === 0) return { error: "The notification couldn't be delivered. Try turning reminders off and on again." };
  return { delivered: result.delivered };
}
