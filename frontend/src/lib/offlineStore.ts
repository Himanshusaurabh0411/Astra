import seed from "../../../backend/app/data/seed_catchment.geojson";
import type {
  DispatchVector, GeoJsonFeatureCollection, OperationalMode, SOSPacket,
} from "./terrapulseClient";

export interface NavicFixData {
  lat: number;
  lng: number;
  accuracy_m: number;
  navic_band: string;
  locked_at: string;
  is_simulated: boolean;
}

const DB_NAME = "terrapulse_offline_db";
const DB_VERSION = 1;
const GIS = "gis_features";
const DISPATCHES = "dispatch_vectors";
const LOCATION = "navic_fixes";
const SOS = "offline_sos_queue";
const EXERCISE_SNAPSHOT = "india_exercise_map";
let database: Promise<IDBDatabase> | undefined;

export const SEEDED_BASIN_FEATURES = seed as GeoJsonFeatureCollection;
export const SEEDED_DISPATCHES: DispatchVector[] = [{
  dispatch_id: "DSP-KOTHRI-VEC-01",
  issued_at: "2026-11-21T18:00:00Z",
  mode: "NORMAL",
  target_zone_id: "central-india",
  alert_headline: "Exercise route to the VIT Bhopal relief shelter.",
  evacuation_corridor: {
    type: "LineString",
    coordinates: [[77.125, 23.21], [77.095, 23.185], [77.06, 23.145], [77.035, 23.11], [77.016, 23.0805]],
  },
  safe_asset: { name: "VIT Bhopal Auditorium & Relief Shelter", lat: 23.0805, lng: 77.016 },
  payload_kb: 0.48,
}];

function openDatabase(): Promise<IDBDatabase> {
  database ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      db.createObjectStore(GIS, { keyPath: "id" });
      db.createObjectStore(DISPATCHES, { keyPath: "dispatch_id" });
      db.createObjectStore(LOCATION, { keyPath: "id" });
      db.createObjectStore(SOS, { keyPath: "sos_id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Offline storage is busy."));
  });
  return database;
}

async function read<T>(name: string, key?: string): Promise<T> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const store = db.transaction(name, "readonly").objectStore(name);
    const request = key ? store.get(key) : store.getAll();
    request.onsuccess = () => resolve(request.result as T);
    request.onerror = () => reject(request.error);
  });
}

async function write(name: string, update: (store: IDBObjectStore) => void): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(name, "readwrite");
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
    update(tx.objectStore(name));
  });
}

interface MapSnapshot {
  id: string;
  collection: GeoJsonFeatureCollection;
  mode: OperationalMode;
}

export async function getCachedMap(): Promise<MapSnapshot | undefined> {
  try {
    return await read<MapSnapshot | undefined>(GIS, EXERCISE_SNAPSHOT);
  } catch {
    return undefined;
  }
}

export async function getCachedFeatures(): Promise<GeoJsonFeatureCollection | null> {
  return (await getCachedMap())?.collection ?? SEEDED_BASIN_FEATURES;
}

export async function saveCachedFeatures(collection: GeoJsonFeatureCollection, mode: OperationalMode = "NORMAL"): Promise<void> {
  try {
    await write(GIS, (store) => store.put({ id: EXERCISE_SNAPSHOT, collection, mode }));
  } catch {
    // The bundled map is always available if browser storage is disabled.
  }
}

export async function getCachedDispatches(): Promise<DispatchVector[]> {
  try {
    const snapshots = await read<DispatchVector[]>(DISPATCHES);
    return snapshots.length ? snapshots : SEEDED_DISPATCHES;
  } catch {
    return SEEDED_DISPATCHES;
  }
}

export async function saveCachedDispatches(dispatches: DispatchVector[]): Promise<void> {
  try {
    await write(DISPATCHES, (store) => {
      store.clear();
      for (const dispatch of dispatches.slice(-50)) store.put(dispatch);
    });
  } catch {
    // Keep the in-memory copy when browser storage is disabled.
  }
}

export async function getNavicFix(): Promise<NavicFixData | null> {
  try {
    const found = await read<{ id: string; fix: NavicFixData } | undefined>(LOCATION, "field_fix");
    return found?.fix ?? null;
  } catch {
    return null;
  }
}

export async function saveNavicFix(fix: NavicFixData): Promise<void> {
  try {
    await write(LOCATION, (store) => store.put({ id: "field_fix", fix }));
  } catch {
    // Location remains available on the current page.
  }
}

export async function getQueuedOfflineSOS(): Promise<SOSPacket[]> {
  try {
    return await read<SOSPacket[]>(SOS);
  } catch {
    return [];
  }
}

export async function queueOfflineSOS(packet: SOSPacket): Promise<void> {
  await write(SOS, (store) => store.put(packet));
  if ("serviceWorker" in navigator) {
    void navigator.serviceWorker.ready.then((registration) => {
      const worker = registration as ServiceWorkerRegistration & { sync?: { register(tag: string): Promise<void> } };
      return worker.sync?.register("terrapulse-sos");
    }).catch(() => {
      // The responder page retries when a connection returns.
    });
  }
}

export async function updateQueuedOfflineSOS(packet: SOSPacket): Promise<void> {
  await queueOfflineSOS(packet);
}

export async function removeQueuedSOS(ids: string[]): Promise<void> {
  await write(SOS, (store) => {
    for (const id of ids) store.delete(id);
  });
}

export async function clearSyncedOfflineSOS(): Promise<void> {
  const queue = await getQueuedOfflineSOS();
  await removeQueuedSOS(queue.filter((p) => p.mesh.sync_status === "SYNCED_COMMAND").map((p) => p.sos_id));
}
