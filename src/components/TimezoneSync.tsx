"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { syncTimezone } from "@/app/timezone/actions";
import { isDefinitiveOutcome, timeZoneAction } from "@/lib/timezoneSync";

const ATTEMPT_KEY = "gym-journo-tz-attempt";
// Per device: the zone this device is in, for which the person chose to keep the account's zone.
const KEPT_KEY = "gym-journo-tz-kept";

function read(storage: () => Storage, key: string): string | null {
  try {
    return storage().getItem(key);
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: string) {
  try {
    storage().setItem(key, value);
  } catch {
    // Private mode etc. — worst case it tries (or asks) again on the next page load.
  }
}

const session = () => sessionStorage;
const local = () => localStorage;
const noopSubscribe = () => () => {};

// "none", or "sync:<zone>" / "ask:<zone>" for this device's zone. Read on the client only (the
// server snapshot is "none"), so the first render matches the server's HTML.
function decide(stored: string | null): string {
  const browser = Intl.DateTimeFormat().resolvedOptions().timeZone || null;
  const action = timeZoneAction({
    stored,
    browser,
    attemptedThisSession: read(session, ATTEMPT_KEY),
    keptOnThisDevice: read(local, KEPT_KEY),
  });
  return browser && action !== "none" ? `${action}:${browser}` : "none";
}

// Keeps the account's timezone right for its devices. With none stored yet, it stores this device's
// zone without asking. With a different zone stored (travel, or a second device elsewhere), it asks
// first. Either way it then refreshes so the page drawn with the old "today" is drawn again.
export default function TimezoneSync({ stored }: { stored: string | null }) {
  const router = useRouter();
  const decision = useSyncExternalStore(noopSubscribe, () => decide(stored), () => "none");
  const [dismissed, setDismissed] = useState(false);

  function store(browser: string) {
    return syncTimezone(browser)
      .then(({ outcome }) => {
        if (isDefinitiveOutcome(outcome)) write(session, ATTEMPT_KEY, browser);
        if (outcome === "updated") router.refresh();
      })
      .catch(() => {});
  }

  useEffect(() => {
    if (decision.startsWith("sync:")) void store(decision.slice("sync:".length));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [decision]);

  const ask = !dismissed && decision.startsWith("ask:") ? decision.slice("ask:".length) : null;
  if (!ask || !stored) return null;

  return (
    <div
      role="dialog"
      aria-label="Time zone"
      className="material fixed inset-x-3 bottom-24 z-30 mx-auto flex max-w-md flex-col gap-2 rounded-xl border border-separator p-3 text-sm shadow-popover md:bottom-4"
    >
      <p>
        This device is in <strong>{ask.replace(/_/g, " ")}</strong>, but your account uses{" "}
        <strong>{stored.replace(/_/g, " ")}</strong>. Which should decide your &ldquo;today&rdquo;?
      </p>
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            write(local, KEPT_KEY, ask);
            setDismissed(true);
          }}
          className="h-9 rounded-lg border border-separator px-3 font-medium hover:bg-fill"
        >
          Keep {stored.split("/").pop()?.replace(/_/g, " ")}
        </button>
        <button
          type="button"
          onClick={() => {
            setDismissed(true);
            void store(ask);
          }}
          className="h-9 rounded-lg bg-accent px-3 font-semibold text-on-accent hover:bg-accent-hover"
        >
          Use {ask.split("/").pop()?.replace(/_/g, " ")}
        </button>
      </div>
    </div>
  );
}
