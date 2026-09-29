"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
  updateReminderSettings,
} from "./reminderActions";

type Support =
  | "checking"
  | "unsupported" // no service worker / Push API in this browser
  | "needs-install" // iPhone/iPad Safari: push only works from the Home Screen app
  | "no-worker" // no service worker (dev builds don't register one)
  | "blocked" // notifications were denied in browser settings
  | "ready";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

// The Push API wants the VAPID key as bytes; it's distributed as URL-safe base64.
function urlBase64ToUint8Array(value: string): Uint8Array<ArrayBuffer> {
  const base64 = (value + "=".repeat((4 - (value.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

function isIosBrowserTab() {
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return ios && !standalone;
}

async function detectSupport(): Promise<{ support: Support; subscription: PushSubscription | null }> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { support: isIosBrowserTab() ? "needs-install" : "unsupported", subscription: null };
  }
  // ServiceWorkerRegister registers the worker in production; registering again here is a no-op
  // that also covers the first page load, before that has finished.
  const registration =
    process.env.NODE_ENV === "production"
      ? await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
      : await navigator.serviceWorker.getRegistration();
  if (!registration) return { support: "no-worker", subscription: null };
  const subscription = await registration.pushManager.getSubscription();
  if (Notification.permission === "denied") return { support: "blocked", subscription };
  return { support: "ready", subscription };
}

// Opt-in reminders on days with a planned workout: the setting (on/off, local time) is per account,
// the push subscription is per device. The server sends at most one reminder a day, and none once
// a set has been logged.
export default function RemindersSection({ enabled, time }: { enabled: boolean; time: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [support, setSupport] = useState<Support>("checking");
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [reminderTime, setReminderTime] = useState(time);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    detectSupport()
      .then((result) => {
        if (cancelled) return;
        setSupport(result.support);
        setSubscription(result.subscription);
      })
      .catch(() => !cancelled && setSupport("unsupported"));
    return () => {
      cancelled = true;
    };
  }, []);

  if (!VAPID_PUBLIC_KEY) return null;

  function run(task: () => Promise<string | null | void>) {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const message = await task();
        if (message) setNotice(message);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
      }
    });
  }

  function turnOn() {
    run(async () => {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        if (permission === "denied") setSupport("blocked");
        throw new Error("Notifications weren't allowed, so reminders can't be shown on this device.");
      }
      const registration = await navigator.serviceWorker.ready;
      const current =
        (await registration.pushManager.getSubscription()) ??
        (await registration.pushManager
          .subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) })
          .catch(() => {
            throw new Error("This browser couldn't set up notifications. Please try again later.");
          }));
      const saved = await savePushSubscription(current.toJSON(), navigator.userAgent);
      if ("error" in saved) throw new Error(saved.error);
      setSubscription(current);

      const settings = await updateReminderSettings({ enabled: true, time: reminderTime });
      if ("error" in settings) throw new Error(settings.error);
      router.refresh();
    });
  }

  function turnOff() {
    run(async () => {
      const settings = await updateReminderSettings({ enabled: false, time: reminderTime });
      if ("error" in settings) throw new Error(settings.error);
      if (subscription) {
        const endpoint = subscription.endpoint;
        await subscription.unsubscribe().catch(() => false);
        await removePushSubscription(endpoint);
        setSubscription(null);
      }
      router.refresh();
    });
  }

  function saveTime() {
    run(async () => {
      const settings = await updateReminderSettings({ enabled, time: reminderTime });
      if ("error" in settings) throw new Error(settings.error);
      router.refresh();
      return "Reminder time saved.";
    });
  }

  function test() {
    run(async () => {
      const result = await sendTestNotification();
      if ("error" in result) throw new Error(result.error);
      return result.delivered === 1 ? "Sent — check your notifications." : `Sent to ${result.delivered} devices.`;
    });
  }

  const thisDeviceOn = enabled && subscription !== null;
  const timeChanged = reminderTime !== time;

  return (
    <section className="mt-5 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <h2 className="mb-1 text-sm font-semibold text-neutral-100">Workout reminders</h2>
      <p className="mb-3 text-xs text-neutral-400">
        A notification on days you&apos;ve planned a workout, at the time you choose. Rest days are skipped, and
        there&apos;s no reminder once you&apos;ve logged a set.
      </p>

      <label className="mb-3 flex items-center gap-3 text-xs text-neutral-300">
        Remind me at
        <input
          type="time"
          value={reminderTime}
          onChange={(e) => setReminderTime(e.target.value)}
          className="rounded-lg border border-neutral-700 bg-neutral-950 px-2 py-1 text-sm text-neutral-100"
        />
        {enabled && timeChanged && reminderTime && (
          <button
            type="button"
            onClick={saveTime}
            disabled={pending}
            className="rounded-lg border border-neutral-700 px-3 py-1 text-xs font-medium text-neutral-300 disabled:opacity-50"
          >
            Save time
          </button>
        )}
      </label>

      {support === "checking" && <p className="text-xs text-neutral-500">Checking this device…</p>}
      {support === "unsupported" && (
        <p className="text-xs text-neutral-500">This browser doesn&apos;t support notifications.</p>
      )}
      {support === "needs-install" && (
        <p className="text-xs text-neutral-400">
          On iPhone and iPad, reminders work from the installed app: tap Share → Add to Home Screen, then open
          Gym-Journo from your Home Screen and turn reminders on there.
        </p>
      )}
      {support === "no-worker" && (
        <p className="text-xs text-neutral-500">Notifications need a production build (npm run build, npm start).</p>
      )}
      {support === "blocked" && (
        <p className="text-xs text-neutral-400">
          Notifications are blocked for this site. Allow them in your browser or system settings, then reload.
        </p>
      )}

      {support === "ready" && (
        <div className="flex flex-wrap items-center gap-3">
          {thisDeviceOn ? (
            <>
              <p className="text-xs text-green-400">On for this device</p>
              <button
                type="button"
                onClick={test}
                disabled={pending}
                className="text-xs text-neutral-300 underline disabled:opacity-50"
              >
                Send a test
              </button>
              <button
                type="button"
                onClick={turnOff}
                disabled={pending}
                className="ml-auto rounded-lg border border-neutral-700 px-3 py-1.5 text-xs font-medium text-neutral-300 disabled:opacity-50"
              >
                Turn off
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={turnOn}
              disabled={pending || !reminderTime}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 disabled:opacity-50"
            >
              {enabled ? "Turn on for this device" : "Turn on reminders"}
            </button>
          )}
        </div>
      )}

      {enabled && !thisDeviceOn && support !== "checking" && (
        <p className="mt-2 text-xs text-neutral-500">Reminders are on, but not for this device.</p>
      )}
      {notice && <p className="mt-2 text-xs text-green-400">{notice}</p>}
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </section>
  );
}
