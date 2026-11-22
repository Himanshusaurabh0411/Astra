/**
 * TerraPulse Offline Persistence Store
 * Dual-layer offline caching using IndexedDB with localStorage fallback.
 * Stores GeoAI GIS layers, command dispatches, queued distress beacons, and NavIC telemetry.
 */

import {
  GeoJsonFeatureCollection,
  DispatchVector,
  SOSPacket,
} from "./terrapulseClient";

const DB_NAME = "terrapulse_offline_db";
const DB_VERSION = 1;

const STORES = {
  GIS_CACHE: "gis_cache",
  DISPATCHES: "dispatches",
  SOS_QUEUE: "sos_queue",
  NAVIC_TELEMETRY: "navic_telemetry",
};

// Helper: Open IndexedDB with automatic schema migration
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !("indexedDB" in window)) {
      return reject(new Error("IndexedDB not supported"));
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (e) => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORES.GIS_CACHE)) {
        db.createObjectStore(STORES.GIS_CACHE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORES.DISPATCHES)) {
        db.createObjectStore(STORES.DISPATCHES, { keyPath: "dispatch_id" });
      }
      if (!db.objectStoreNames.contains(STORES.SOS_QUEUE)) {
        db.createObjectStore(STORES.SOS_QUEUE, { keyPath: "sos_id" });
      }
      if (!db.objectStoreNames.contains(STORES.NAVIC_TELEMETRY)) {
        db.createObjectStore(STORES.NAVIC_TELEMETRY, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==============================================================================
// 1. Cached GeoAI GIS Features
// ==============================================================================

export async function saveCachedFeatures(features: GeoJsonFeatureCollection): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORES.GIS_CACHE, "readwrite");
    const store = tx.objectStore(STORES.GIS_CACHE);
    store.put({ id: "latest_catchment", data: features, updated_at: new Date().toISOString() });
  } catch (err) {
    // Fallback to localStorage
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("terrapulse_cached_features", JSON.stringify(features));
      } catch (e) {
        console.warn("localStorage quota exceeded:", e);
      }
    }
  }
}

export async function getCachedFeatures(): Promise<GeoJsonFeatureCollection | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.GIS_CACHE, "readonly");
      const store = tx.objectStore(STORES.GIS_CACHE);
      const req = store.get("latest_catchment");
      req.onsuccess = () => resolve(req.result ? req.result.data : null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("terrapulse_cached_features");
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  }
}

// ==============================================================================
// 2. Cached Evacuation Dispatches
// ==============================================================================

export async function saveCachedDispatches(dispatches: DispatchVector[]): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORES.DISPATCHES, "readwrite");
    const store = tx.objectStore(STORES.DISPATCHES);
    for (const d of dispatches) {
      store.put(d);
    }
  } catch (err) {
    if (typeof window !== "undefined") {
      localStorage.setItem("terrapulse_cached_dispatches", JSON.stringify(dispatches));
    }
  }
}

export async function getCachedDispatches(): Promise<DispatchVector[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.DISPATCHES, "readonly");
      const store = tx.objectStore(STORES.DISPATCHES);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("terrapulse_cached_dispatches");
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }
}

// ==============================================================================
// 3. Queued Offline SOS Micro-Packets
// ==============================================================================

export async function queueOfflineSOS(packet: SOSPacket): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SOS_QUEUE, "readwrite");
    const store = tx.objectStore(STORES.SOS_QUEUE);
    store.put(packet);
  } catch (err) {
    if (typeof window !== "undefined") {
      const queue = await getQueuedOfflineSOS();
      const filtered = queue.filter((p) => p.sos_id !== packet.sos_id);
      filtered.push(packet);
      localStorage.setItem("terrapulse_sos_queue", JSON.stringify(filtered));
    }
  }
}

export async function getQueuedOfflineSOS(): Promise<SOSPacket[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.SOS_QUEUE, "readonly");
      const store = tx.objectStore(STORES.SOS_QUEUE);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => resolve([]);
    });
  } catch (err) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("terrapulse_sos_queue");
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }
}

export async function updateQueuedOfflineSOS(packet: SOSPacket): Promise<void> {
  return queueOfflineSOS(packet);
}

export async function clearQueuedOfflineSOS(): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORES.SOS_QUEUE, "readwrite");
    const store = tx.objectStore(STORES.SOS_QUEUE);
    store.clear();
  } catch (err) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("terrapulse_sos_queue");
    }
  }
}

export async function markPacketSynced(sos_id: string): Promise<void> {
  const queue = await getQueuedOfflineSOS();
  const packet = queue.find((p) => p.sos_id === sos_id);
  if (packet) {
    packet.mesh.sync_status = "SYNCED_COMMAND";
    await queueOfflineSOS(packet);
  }
}

// ==============================================================================
// 4. NavIC Telemetry Fix
// ==============================================================================

export interface NavicFixData {
  lat: number;
  lng: number;
  accuracy_m: number;
  navic_band: string;
  locked_at: string;
  is_simulated: boolean;
}

export async function saveNavicFix(fix: NavicFixData): Promise<void> {
  try {
    const db = await openDatabase();
    const tx = db.transaction(STORES.NAVIC_TELEMETRY, "readwrite");
    const store = tx.objectStore(STORES.NAVIC_TELEMETRY);
    store.put({ key: "active_fix", ...fix });
  } catch (err) {
    if (typeof window !== "undefined") {
      localStorage.setItem("terrapulse_navic_fix", JSON.stringify(fix));
    }
  }
}

export async function getNavicFix(): Promise<NavicFixData | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORES.NAVIC_TELEMETRY, "readonly");
      const store = tx.objectStore(STORES.NAVIC_TELEMETRY);
      const req = store.get("active_fix");
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    });
  } catch (err) {
    if (typeof window !== "undefined") {
      const raw = localStorage.getItem("terrapulse_navic_fix");
      return raw ? JSON.parse(raw) : null;
    }
    return null;
  }
}
