"use client";

import { useOffline } from "next/offline";

export default function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-30 border-b border-orange/30 bg-orange/12 px-4 py-2 text-center text-xs text-orange pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      You&apos;re offline. Workout changes are kept on this device and sync when you reconnect. Pages you haven&apos;t
      opened yet will load once you&apos;re back online.
    </div>
  );
}
