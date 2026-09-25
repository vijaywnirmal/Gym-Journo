"use client";

import { useOffline } from "next/offline";

export default function OfflineBanner() {
  const offline = useOffline();
  if (!offline) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-30 border-b border-amber-900 bg-amber-950/95 px-4 py-2 text-center text-xs text-amber-200 pt-[max(0.5rem,env(safe-area-inset-top))]"
    >
      You&apos;re offline. Workout changes are kept on this device and sync when you reconnect.
    </div>
  );
}
