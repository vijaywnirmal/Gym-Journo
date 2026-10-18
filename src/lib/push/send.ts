import webpush, { WebPushError } from "web-push";
import type { PushPayload } from "./reminderMessage";

// Sending web push (server only). The VAPID key pair identifies this app to browsers' push services;
// the public half is also given to the browser when it subscribes.

export type PushConfig = { publicKey: string; privateKey: string; subject: string };

// Null when push isn't configured (reminders then stay hidden and the job does nothing).
export function pushConfigFromEnv(env: Record<string, string | undefined> = process.env): PushConfig | null {
  const publicKey = env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return null;
  return { publicKey, privateKey, subject };
}

export type StoredSubscription = { endpoint: string; p256dh: string; auth: string };

// Delivers one payload to one subscription. Resolves with the push service's status code.
export type PushTransport = (subscription: StoredSubscription, payload: PushPayload) => Promise<number>;

// A reminder is only useful today: push services may drop it if the device stays offline longer.
const TTL_SECONDS = 6 * 60 * 60;

export function webPushTransport(config: PushConfig): PushTransport {
  return async (subscription, payload) => {
    const result = await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(payload),
      { TTL: TTL_SECONDS, urgency: "normal", vapidDetails: config }
    );
    return result.statusCode;
  };
}

export type DeliveryResult = {
  delivered: number;
  // Endpoints the push service says are gone for good (404/410): remove them.
  expired: string[];
  failed: number;
};

// Sends to every subscription, one failure never stopping the rest.
export async function deliver(
  subscriptions: StoredSubscription[],
  payload: PushPayload,
  transport: PushTransport
): Promise<DeliveryResult> {
  const result: DeliveryResult = { delivered: 0, expired: [], failed: 0 };
  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        await transport(subscription, payload);
        result.delivered++;
      } catch (error) {
        const status = error instanceof WebPushError ? error.statusCode : null;
        if (status === 404 || status === 410) result.expired.push(subscription.endpoint);
        else result.failed++;
      }
    })
  );
  return result;
}
