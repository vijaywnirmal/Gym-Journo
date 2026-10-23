"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import Select from "@/components/ui/Select";
import {
  removePushSubscription,
  savePushSubscription,
  sendTestNotification,
  updateReminderSettings, removeOtherPushSubscriptions } from "./reminderActions";

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
export default function RemindersSection({
  enabled,
  time,
  hasTrainer = false,
}: {
  enabled: boolean;
  time: string;
  // A client also hears from their trainer here (a plan they made), with the same switch.
  hasTrainer?: boolean;
}) {
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

  function removeOthers() {
    run(async () => {
      const result = await removeOtherPushSubscriptions(subscription?.endpoint ?? null);
      if ("error" in result) throw new Error(result.error);
      return subscription ? "Other devices removed. Reminders now go to this device only." : "All devices removed.";
    });
  }

  const thisDeviceOn = enabled && subscription !== null;
  const timeChanged = reminderTime !== time;

  return (
    <>
      <h2 className="section-title mt-8">Notifications</h2>
      <section className="card p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-orange/12 text-orange">
            <Icon name="bell" className="size-[18px]" strokeWidth={2} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              Workout reminders
              {/* The account's setting, which may be on through another device. */}
              {support !== "checking" && (
                <span
                  className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${
                    enabled ? "bg-green/12 text-green" : "bg-fill text-label-2"
                  }`}
                >
                  {enabled ? "On" : "Off"}
                </span>
              )}
            </h2>
            <p className="text-sm text-label-2">
              A notification on days you&apos;ve planned a workout. Rest days are skipped, and there&apos;s no reminder
              once you&apos;ve logged a set.{hasTrainer && " Your trainer's plans for you come here too."}
            </p>
          </div>
        </div>

        <div className="mt-3 ml-12 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-label-2">Remind me at</span>
            <Select
              value={reminderTime}
              onChange={setReminderTime}
              options={timeOptions(reminderTime)}
              ariaLabel="Reminder time"
              searchable={false}
              className="w-32"
            />
            {enabled && timeChanged && reminderTime && (
              <button
                type="button"
                onClick={saveTime}
                disabled={pending}
                className="h-9 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill disabled:opacity-50"
              >
                Save time
              </button>
            )}
          </div>

          {support === "checking" && <div className="skeleton h-8 w-40" aria-label="Checking this device" />}
          {support === "unsupported" && <p className="text-sm text-label-2">This browser doesn&apos;t support notifications.</p>}
          {support === "needs-install" && (
            <p className="text-sm text-label-2">
              On iPhone and iPad, reminders work from the installed app: tap Share → Add to Home Screen, then open
              Gym Journo from your Home Screen and turn reminders on there.
            </p>
          )}
          {support === "no-worker" && (
            <p className="text-sm text-label-2">Notifications need a production build (npm run build, npm start).</p>
          )}
          {support === "blocked" && (
            <p className="text-sm text-label-2">
              Notifications are blocked for this site. Allow them in your browser or system settings, then reload.
            </p>
          )}

          {support === "ready" && (
            <div className="flex flex-wrap items-center gap-2">
              {thisDeviceOn ? (
                <>
                  <button
                    type="button"
                    onClick={test}
                    disabled={pending}
                    className="h-8 rounded-lg border border-separator px-3 text-sm font-semibold hover:bg-fill disabled:opacity-50"
                  >
                    Send a test
                  </button>
                  <button
                    type="button"
                    onClick={turnOff}
                    disabled={pending}
                    className="h-8 rounded-lg px-3 text-sm font-medium text-label-2 hover:bg-fill disabled:opacity-50"
                  >
                    Turn off
                  </button>
                  <button
                    type="button"
                    onClick={removeOthers}
                    disabled={pending}
                    className="h-8 rounded-lg px-3 text-sm font-medium text-label-2 hover:bg-fill disabled:opacity-50"
                  >
                    Remove other devices
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={turnOn}
                  disabled={pending || !reminderTime}
                  className="h-9 rounded-lg bg-accent px-3.5 text-sm font-semibold text-on-accent hover:bg-accent-hover disabled:opacity-50"
                >
                  {enabled ? "Turn on for this device" : "Turn on reminders"}
                </button>
              )}
            </div>
          )}

          {/* Reminders on through another (or a lost) device can be turned off from anywhere. */}
          {enabled && !thisDeviceOn && support !== "checking" && (
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs text-label-2">Reminders are on, but not for this device.</p>
              <button
                type="button"
                onClick={turnOff}
                disabled={pending}
                className="h-8 rounded-lg px-3 text-sm font-medium text-label-2 hover:bg-fill disabled:opacity-50"
              >
                Turn off reminders
              </button>
            </div>
          )}
          {notice && <p className="text-sm text-green">{notice}</p>}
          {error && <p className="text-sm text-red">{error}</p>}
        </div>
      </section>
    </>
  );
}

// Reminder times every 15 minutes, labelled in 12-hour time. A saved time off that grid (set
// before this picker existed) is kept as an option so it still shows as selected.
function timeOptions(current: string) {
  const options: { value: string; label: string }[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += 15) {
    const value = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
    options.push({ value, label: formatTime(value) });
  }
  if (current && !options.some((o) => o.value === current)) {
    options.push({ value: current, label: formatTime(current) });
    options.sort((a, b) => a.value.localeCompare(b.value));
  }
  return options;
}

function formatTime(value: string): string {
  const [h, m] = value.split(":").map(Number);
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
