const CACHE = "terrapulse-offline-v6";
const PAGES = ["/", "/field"];
const ASSETS = [
  "/manifest.json", "/icon-192.png", "/icon-512.png", "/india-terrain.webp",
  "/fonts/plus-jakarta-sans.woff2", "/fonts/jetbrains-mono.woff2",
];
let warming;

function prepare() {
  warming ??= (async () => {
    const cache = await caches.open(CACHE);
    const assets = new Set(ASSETS);
    for (const path of PAGES) {
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) throw new Error("Page unavailable");
      const html = await response.clone().text();
      for (const match of html.matchAll(/(?:src|href)="(\/_next\/static\/[^"]+)"/g)) {
        assets.add(match[1].replaceAll("&amp;", "&"));
      }
      await cache.put(path, response);
    }
    await Promise.all([...assets].map(async (path) => {
      if (await cache.match(path)) return;
      const response = await fetch(path, { cache: "reload" });
      if (!response.ok) throw new Error("Asset unavailable");
      await cache.put(path, response);
    }));
  })().finally(() => { warming = undefined; });
  return warming;
}

self.addEventListener("install", (event) => {
  event.waitUntil(prepare().then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("terrapulse-") && key !== CACHE)
      .map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "PREPARE_OFFLINE") return;
  event.waitUntil(prepare().then(
    () => event.source?.postMessage({ type: "OFFLINE_READY" }),
    () => event.source?.postMessage({ type: "OFFLINE_DEFERRED" }),
  ));
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && PAGES.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const response = await fetch(request);
        if (response.ok) {
          await cache.put(url.pathname, response.clone());
          return response;
        }
        return (await cache.match(url.pathname)) ?? response;
      } catch {
        return (await cache.match(url.pathname)) ?? Response.error();
      }
    })());
    return;
  }

  if (url.pathname.startsWith("/_next/static/") || ASSETS.includes(url.pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const saved = await cache.match(request);
      if (saved) return saved;
      const response = await fetch(request);
      if (response.ok) await cache.put(request, response.clone());
      return response;
    })());
  }
});

function openQueue() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("terrapulse_offline_db", 1);
    request.onupgradeneeded = () => request.transaction.abort();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function queuedPackets(db) {
  return new Promise((resolve, reject) => {
    const request = db.transaction("offline_sos_queue").objectStore("offline_sos_queue").getAll();
    request.onsuccess = () => resolve(request.result.filter((packet) => packet.mesh.sync_status !== "SYNCED_COMMAND"));
    request.onerror = () => reject(request.error);
  });
}

async function syncHelp() {
  const health = await fetch("/health", { cache: "no-store" });
  if (!health.ok || (await health.json()).mode === "CELL_BLACKOUT_MESH_ACTIVE") throw new Error("Gateway unavailable");
  const db = await openQueue();
  let sent = 0;
  const emails = [];
  try {
    const packets = await queuedPackets(db);
    for (let offset = 0; offset < packets.length; offset += 50) {
      const response = await fetch("/api/sos", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(packets.slice(offset, offset + 50)),
      });
      if (!response.ok) throw new Error("Help requests could not sync");
      const acknowledgements = (await response.json()).filter((packet) => packet.mesh.sync_status === "SYNCED_COMMAND");
      await new Promise((resolve, reject) => {
        const tx = db.transaction("offline_sos_queue", "readwrite");
        const store = tx.objectStore("offline_sos_queue");
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
        for (const packet of acknowledgements) store.delete(packet.sos_id);
      });
      sent += acknowledgements.length;
      for (const { sos_id, email_notification } of acknowledgements) {
        if (email_notification) emails.push({ sos_id, email_notification });
      }
    }
  } finally {
    db.close();
    if (sent) {
      const clients = await self.clients.matchAll({ type: "window" });
      for (const client of clients) {
        if (new URL(client.url).pathname === "/field") client.postMessage({ type: "SOS_SYNCED", count: sent, emails });
      }
    }
  }
}

self.addEventListener("sync", (event) => {
  if (event.tag === "terrapulse-sos") event.waitUntil(syncHelp());
});
