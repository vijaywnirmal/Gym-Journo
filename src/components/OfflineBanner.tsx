"use client";

import { useState } from "react";
import { useOffline } from "next/offline";

export default function OfflineBanner() {
  const offline = useOffline();
  const [wasOffline, setWasOffline] = useState(false);
  if (offline && !wasOffline) setWasOffline(true);

  // Always there, even when empty: screen readers only announce changes to a region they already know.
  return (
    <div role="status" className="contents">
      {offline ? (
        <div className="sticky top-0 z-30 border-b border-orange/30 bg-orange/12 px-4 py-2 text-center text-xs text-orange pt-[max(0.5rem,env(safe-area-inset-top))]">
          You&apos;re offline. Workout changes are kept on this device and sync
          when you reconnect. Pages you haven&apos;t opened yet will load once
          you&apos;re back online.
        </div>
      ) : (
        wasOffline && <p className="sr-only">You&apos;re back online.</p>
      )}
    </div>
  );
}
