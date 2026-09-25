"use client";

import { useEffect } from "react";

// Registers public/sw.js in production builds only — in dev a service worker would cache
// hot-reloaded assets and make changes look like they didn't apply.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {
      // Not fatal: the app works without it, just without the offline fallback.
    });
  }, []);
  return null;
}
