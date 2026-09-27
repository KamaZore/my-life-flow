/* Flowday service worker — offline-first caching so the app opens with no network */
// Bump this version whenever app assets change so clients pick up the new
// build instead of serving a stale cache (classic "preview looks broken" bug).
const VERSION = "flowday-v56-unified-settings";
const BASE = new URL(self.registration.scope).pathname; // supports subpath hosting

// Static app shell (public/ files) — cached at install.
const APP_SHELL = [
  "",
  "manifest.webmanifest",
  "logo.svg",
  "favicon-16.png",
  "favicon-32.png",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
  "icon-maskable-192.png",
  "icon-maskable-512.png",
  "offline.html",
].map((p) => new URL(p, self.registration.scope).href);

// Google Fonts (CSS + font binaries) so Khmer/Latin text renders offline too.
const FONT_ORIGINS = ["https://fonts.googleapis.com", "https://fonts.gstatic.com"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) =>
        Promise.allSettled(APP_SHELL.map((url) => cache.add(url))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Never cache the database API — data lives locally, sync happens online.
  if (url.pathname.includes("/sql") || url.hostname.includes("neon.tech")) return;

  // Google Fonts: stale-while-revalidate so text works offline from the 2nd load.
  if (FONT_ORIGINS.includes(url.origin)) {
    event.respondWith(
      caches.open(VERSION).then(async (cache) => {
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res.ok) cache.put(req, res.clone());
            return res;
          })
          .catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }

  if (url.origin !== location.origin) return; // anything else passes through

  // Navigations: try network first (fresh deploys win), fall back to the
  // cached page, then to the root index, then to the offline notice.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
          return res;
        })
        .catch(async () =>
          (await caches.match(req)) ||
          (await caches.match(BASE)) ||
          (await caches.match(new URL("index.html", self.registration.scope).href)) ||
          caches.match(BASE + "offline.html"),
        ),
    );
    return;
  }

  // Same-origin requests (JS/CSS bundles, icons, any page asset): cache-first
  // with runtime caching. Hashed Vite bundles never change, so cache-first is
  // both fast and correct, and it guarantees the app opens fully offline.
  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req).then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(req, copy));
        }
        return res;
      });
    }),
  );
});
