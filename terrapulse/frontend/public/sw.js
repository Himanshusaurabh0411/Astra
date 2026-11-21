// ==============================================================================
// TerraPulse Tactical Offline Service Worker
// Offline Caching for /field, /, and GIS Hazard Corridors
// ==============================================================================

const CACHE_NAME = "terrapulse-tactical-cache-v1";
const STATIC_ASSETS = [
  "/",
  "/field",
  "/manifest.json",
  "/favicon.ico"
];

// Install: Pre-cache core emergency pages
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("🛰️ [TerraPulse SW] Pre-caching static assets for offline rescue operations");
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate: Clean up old cache versions
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Network-first with cache fallback for state API, Cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // If fetching API state, attempt network first, but fall back to cached response
  if (url.pathname.startsWith("/api/state")) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // General routes: Stale-while-revalidate or cache fallback
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networked = fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && event.request.method === "GET") {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch((err) => {
          // Offline fallback
          return cached;
        });

      return cached || networked;
    })
  );
});
