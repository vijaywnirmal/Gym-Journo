// Gym-Journo service worker. Deliberately small:
// - Hashed build assets (/_next/static) are cached on first use, so the app shell loads fast and
//   keeps working through flaky gym Wi-Fi.
// - Page loads always go to the network (they are per-user and must never be served stale or to
//   another account on a shared device); if the network is down, a static offline page is shown.
// - Everything else, including every POST (Server Actions), passes straight through. Saving a
//   workout offline is handled in the app (experimental.useOffline retry + on-device backup).
const VERSION = "v1";
const STATIC_CACHE = `gj-static-${VERSION}`;
const SHELL_CACHE = `gj-shell-${VERSION}`;
const SHELL_ASSETS = ["/offline.html", "/icons/icon-192.png", "/icons/icon.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("gj-") && key !== STATIC_CACHE && key !== SHELL_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/offline.html")));
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      })
    );
  }
});
