/**
 * TerraPulse Offline Storage Engine
 * IndexedDB + localStorage fallback for tactical field operations in cellular blackouts.
 * Caches GIS GeoJSON features, passive NavIC fixes, LoRa SOS beacons, and evacuation dispatches.
 */

import {
  GeoJsonFeatureCollection,
  DispatchVector,
  SOSPacket,
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
const STORE_GIS = "gis_features";
const STORE_DISPATCHES = "dispatch_vectors";
const STORE_NAVIC = "navic_fixes";
const STORE_SOS = "offline_sos_queue";

// ==============================================================================
// Seeded Baseline GeoJSON (Kothri Kalan / Sehore / Bhopal Basin, Madhya Pradesh)
// Guaranteed instant offline hydration even on 0-connection initial loads.
// ==============================================================================
export const SEEDED_BASIN_FEATURES: GeoJsonFeatureCollection = {
  type: "FeatureCollection",
  metadata: {
    source_portal: "TerraPulse_GeoAI",
    generated_at: new Date().toISOString(),
    payload_kb: 14.2,
    scenario_mode: "BASELINE",
    rainfall_threshold_mm_hr: 15.0,
    basin_name: "Kothri Kalan / Sehore / Bhopal Basin (Madhya Pradesh)",
    bounding_box: [77.01, 23.07, 77.43, 23.27],
  },
  features: [
    {
      type: "Feature",
      id: "MOSDAC-RAIN-KOTHRI-01",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.0100, 23.0700],
            [77.2000, 23.0700],
            [77.2000, 23.2200],
            [77.0100, 23.2200],
            [77.0100, 23.0700],
          ],
        ],
      },
      properties: {
        layer: "mosdac_rain",
        title: "MOSDAC INSAT-3DS Hourly Precipitation Grid - Kothri/Sehore Sector",
        hazard_type: "NONE",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.0,
        road_status: "NA",
        asset_type: "NONE",
        evacuation_priority: 1,
        recommended_action: "Routine hydro-meteorological nowcasting; rainfall below 15.0 mm/hr threshold.",
        sensor: "INSAT-3DS TIR1 / GSMaP_ISRO (0.1 deg)",
      },
    },
    {
      type: "Feature",
      id: "BHOONIDHI-SAR-SEVAN-01",
      geometry: {
        type: "Polygon",
        coordinates: [
          [
            [77.0300, 23.0800],
            [77.0650, 23.0950],
            [77.0900, 23.1200],
            [77.0750, 23.1350],
            [77.0400, 23.1100],
            [77.0200, 23.0900],
            [77.0300, 23.0800],
          ],
        ],
      },
      properties: {
        layer: "bhoonidhi_flood",
        title: "Bhoonidhi EOS-04 SAR Flood Extent - Sevan River Catchment",
        hazard_type: "NONE",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.2,
        road_status: "NA",
        asset_type: "RESERVOIR",
        evacuation_priority: 1,
        recommended_action: "Normal riverbed channel flow; radar backscatter values nominal (>-12 dB).",
        sensor: "EOS-04 C-band SAR (Level-2B ARD)",
      },
    },
    {
      type: "Feature",
      id: "VEDAS-ROAD-SH18-01",
      geometry: {
        type: "LineString",
        coordinates: [
          [77.0120, 23.0780],
          [77.0450, 23.0850],
          [77.0850, 23.1200],
          [77.1400, 23.1700],
          [77.2200, 23.2100],
          [77.3500, 23.2450],
        ],
      },
      properties: {
        layer: "vedas_roads",
        title: "Bhopal-Indore Highway (SH-18/NH-46) Kothri-Sehore Corridor",
        hazard_type: "NONE",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.0,
        road_status: "OPEN",
        asset_type: "NONE",
        evacuation_priority: 1,
        recommended_action: "High-capacity dual-carriageway open; no waterlogging observed.",
        elevation_m: 492.0,
      },
    },
    {
      type: "Feature",
      id: "VEDAS-ROAD-CAUSEWAY-02",
      geometry: {
        type: "LineString",
        coordinates: [
          [77.0420, 23.0820],
          [77.0580, 23.0910],
          [77.0720, 23.1020],
        ],
      },
      properties: {
        layer: "vedas_roads",
        title: "Kothri-Sevan River Causeway Link Road",
        hazard_type: "SUBMERGED_CROSSING",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.1,
        road_status: "OPEN",
        asset_type: "NONE",
        evacuation_priority: 2,
        recommended_action: "Passable; automated telemetry alert primed if catchment rainfall exceeds 15.0 mm/hr.",
        elevation_m: 458.0,
      },
    },
    {
      type: "Feature",
      id: "VEDAS-CORRIDOR-RIDGE-01",
      geometry: {
        type: "LineString",
        coordinates: [
          [77.0160, 23.0805],
          [77.0350, 23.1100],
          [77.0600, 23.1450],
          [77.0950, 23.1850],
          [77.1250, 23.2100],
        ],
      },
      properties: {
        layer: "vedas_corridors",
        title: "VEDAS High-Elevation Ridge Evacuation Corridor (Kothri-Sehore Crest)",
        hazard_type: "NONE",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.0,
        road_status: "CORRIDOR",
        asset_type: "NONE",
        evacuation_priority: 1,
        recommended_action: "Designated all-weather dry evacuation corridor across Cartosat DEM ridge (>510m elevation).",
        elevation_m: 514.0,
      },
    },
    {
      type: "Feature",
      id: "BHUVAN-ASSET-HOSP-01",
      geometry: {
        type: "Point",
        coordinates: [77.0250, 23.0825],
      },
      properties: {
        layer: "bhuvan_assets",
        title: "Community Health Centre (CHC) Kothri Kalan",
        hazard_type: "NONE",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.0,
        road_status: "NA",
        asset_type: "HOSPITAL",
        evacuation_priority: 1,
        recommended_action: "Primary regional emergency trauma and medical triage facility (Capacity: 60 beds).",
        capacity: 60,
        elevation_m: 486.0,
      },
    },
    {
      type: "Feature",
      id: "BHUVAN-ASSET-SHELTER-02",
      geometry: {
        type: "Point",
        coordinates: [77.0160, 23.0805],
      },
      properties: {
        layer: "bhuvan_assets",
        title: "VIT Bhopal Auditorium & Relief Shelter (Kothri Kalan)",
        hazard_type: "NONE",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.0,
        road_status: "NA",
        asset_type: "SHELTER",
        evacuation_priority: 1,
        recommended_action: "Designated high-ground multi-purpose cyclone/flood shelter with auxiliary solar & captive DG backup (Capacity: 2,500).",
        capacity: 2500,
        elevation_m: 512.0,
      },
    },
    {
      type: "Feature",
      id: "BHUVAN-ASSET-GP-03",
      geometry: {
        type: "Point",
        coordinates: [77.0210, 23.0850],
      },
      properties: {
        layer: "bhuvan_assets",
        title: "Kothri Kalan Gram Panchayat Administrative Office",
        hazard_type: "NONE",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.0,
        road_status: "NA",
        asset_type: "GRAM_PANCHAYAT",
        evacuation_priority: 1,
        recommended_action: "Local disaster volunteer staging center and LoRa mesh ground relay station.",
        capacity: 120,
        elevation_m: 488.0,
      },
    },
    {
      type: "Feature",
      id: "BHUVAN-ASSET-SCH-04",
      geometry: {
        type: "Point",
        coordinates: [77.0850, 23.1950],
      },
      properties: {
        layer: "bhuvan_assets",
        title: "Government Higher Secondary School, Sehore West",
        hazard_type: "NONE",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.0,
        road_status: "NA",
        asset_type: "SCHOOL",
        evacuation_priority: 1,
        recommended_action: "Secondary emergency relief center and civilian muster point.",
        capacity: 650,
        elevation_m: 498.0,
      },
    },
    {
      type: "Feature",
      id: "BHUVAN-ASSET-RES-05",
      geometry: {
        type: "Point",
        coordinates: [77.3450, 23.1250],
      },
      properties: {
        layer: "bhuvan_assets",
        title: "Kolar Reservoir Hydrological Regulator Station",
        hazard_type: "NONE",
        severity: "LOW",
        rainfall_mm_hr: 4.8,
        water_depth_m: 0.0,
        road_status: "NA",
        asset_type: "RESERVOIR",
        evacuation_priority: 1,
        recommended_action: "Reservoir live storage at 52% capacity; automated sluice telemetry operating nominal.",
        capacity: 185000000,
        elevation_m: 462.0,
      },
    },
  ],
};

// Initial Seeded Dispatches
export const SEEDED_DISPATCHES: DispatchVector[] = [
  {
    dispatch_id: "DSP-INITIAL-01",
    issued_at: new Date().toISOString(),
    mode: "NORMAL",
    target_zone_id: "ZONE-KOTHRI-KALAN",
    alert_headline: "ADVISORY: Sevan River causeway monitored. SH-18 ridge bypass designated primary evacuation corridor.",
    evacuation_corridor: {
      type: "LineString",
      coordinates: [
        [77.0160, 23.0805],
        [77.0350, 23.1100],
        [77.0600, 23.1450],
        [77.0950, 23.1850],
        [77.1250, 23.2100],
      ],
    },
    safe_asset: {
      name: "VIT Bhopal Auditorium & Relief Shelter",
      lat: 23.0805,
      lng: 77.0160,
      asset_id: "BHUVAN-ASSET-SHELTER-02",
    },
    payload_kb: 1.2,
  },
];

// ==============================================================================
// IndexedDB Helper
// ==============================================================================
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      return reject(new Error("IndexedDB not available in current environment"));
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: any) => {
      const db = event.target.result as IDBDatabase;
      if (!db.objectStoreNames.contains(STORE_GIS)) {
        db.createObjectStore(STORE_GIS, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_DISPATCHES)) {
        db.createObjectStore(STORE_DISPATCHES, { keyPath: "dispatch_id" });
      }
      if (!db.objectStoreNames.contains(STORE_NAVIC)) {
        db.createObjectStore(STORE_NAVIC, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_SOS)) {
        db.createObjectStore(STORE_SOS, { keyPath: "sos_id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ==============================================================================
// GIS Layer Cache
// ==============================================================================
export async function getCachedFeatures(): Promise<GeoJsonFeatureCollection | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_GIS, "readonly");
      const store = tx.objectStore(STORE_GIS);
      const req = store.get("current_catchment");
      req.onsuccess = () => {
        if (req.result && req.result.collection) {
          resolve(req.result.collection);
        } else {
          // Fallback to localStorage or seeded features
          const local = localStorage.getItem("tp_cached_gis");
          if (local) {
            try {
              resolve(JSON.parse(local));
              return;
            } catch {
              // ignore
            }
          }
          resolve(SEEDED_BASIN_FEATURES);
        }
      };
      req.onerror = () => {
        resolve(SEEDED_BASIN_FEATURES);
      };
    });
  } catch {
    // If IndexedDB fails, use localStorage or seed
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("tp_cached_gis");
      if (local) {
        try {
          return JSON.parse(local);
        } catch {}
      }
    }
    return SEEDED_BASIN_FEATURES;
  }
}

export async function saveCachedFeatures(features: GeoJsonFeatureCollection): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("tp_cached_gis", JSON.stringify(features));
    const db = await openDatabase();
    const tx = db.transaction(STORE_GIS, "readwrite");
    const store = tx.objectStore(STORE_GIS);
    store.put({ id: "current_catchment", collection: features, updated_at: new Date().toISOString() });
  } catch (err) {
    console.debug("IndexedDB save failed, saved to localStorage:", err);
  }
}

// ==============================================================================
// Dispatch Vectors Cache
// ==============================================================================
export async function getCachedDispatches(): Promise<DispatchVector[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_DISPATCHES, "readonly");
      const store = tx.objectStore(STORE_DISPATCHES);
      const req = store.getAll();
      req.onsuccess = () => {
        if (req.result && req.result.length > 0) {
          resolve(req.result);
        } else {
          const local = localStorage.getItem("tp_cached_dispatches");
          if (local) {
            try {
              resolve(JSON.parse(local));
              return;
            } catch {}
          }
          resolve(SEEDED_DISPATCHES);
        }
      };
      req.onerror = () => resolve(SEEDED_DISPATCHES);
    });
  } catch {
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("tp_cached_dispatches");
      if (local) {
        try {
          return JSON.parse(local);
        } catch {}
      }
    }
    return SEEDED_DISPATCHES;
  }
}

export async function saveCachedDispatches(dispatches: DispatchVector[]): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("tp_cached_dispatches", JSON.stringify(dispatches));
    const db = await openDatabase();
    const tx = db.transaction(STORE_DISPATCHES, "readwrite");
    const store = tx.objectStore(STORE_DISPATCHES);
    for (const d of dispatches) {
      store.put(d);
    }
  } catch (err) {
    console.debug("IndexedDB save dispatches error:", err);
  }
}

// ==============================================================================
// NavIC Passive Fix Storage
// ==============================================================================
export async function getNavicFix(): Promise<NavicFixData | null> {
  if (typeof window === "undefined") return null;
  try {
    const local = localStorage.getItem("tp_navic_fix");
    if (local) return JSON.parse(local);
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAVIC, "readonly");
      const store = tx.objectStore(STORE_NAVIC);
      const req = store.get("last_fix");
      req.onsuccess = () => resolve(req.result?.fix || null);
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function saveNavicFix(fix: NavicFixData): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("tp_navic_fix", JSON.stringify(fix));
    const db = await openDatabase();
    const tx = db.transaction(STORE_NAVIC, "readwrite");
    const store = tx.objectStore(STORE_NAVIC);
    store.put({ id: "last_fix", fix, updated_at: new Date().toISOString() });
  } catch (err) {
    console.debug("IndexedDB save navic fix error:", err);
  }
}

// ==============================================================================
// Offline LoRa SOS Queue Storage
// ==============================================================================
export async function getQueuedOfflineSOS(): Promise<SOSPacket[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_SOS, "readonly");
      const store = tx.objectStore(STORE_SOS);
      const req = store.getAll();
      req.onsuccess = () => {
        if (req.result && req.result.length > 0) {
          resolve(req.result);
        } else {
          const local = localStorage.getItem("tp_offline_sos");
          if (local) {
            try {
              resolve(JSON.parse(local));
              return;
            } catch {}
          }
          resolve([]);
        }
      };
      req.onerror = () => resolve([]);
    });
  } catch {
    if (typeof window !== "undefined") {
      const local = localStorage.getItem("tp_offline_sos");
      if (local) {
        try {
          return JSON.parse(local);
        } catch {}
      }
    }
    return [];
  }
}

export async function queueOfflineSOS(packet: SOSPacket): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const current = await getQueuedOfflineSOS();
    const filtered = current.filter((p) => p.sos_id !== packet.sos_id);
    const updated = [packet, ...filtered];
    localStorage.setItem("tp_offline_sos", JSON.stringify(updated));

    const db = await openDatabase();
    const tx = db.transaction(STORE_SOS, "readwrite");
    const store = tx.objectStore(STORE_SOS);
    store.put(packet);
  } catch (err) {
    console.debug("IndexedDB queue SOS error:", err);
  }
}

export async function updateQueuedOfflineSOS(
  packetOrId: SOSPacket | string,
  updates?: Partial<SOSPacket>
): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const current = await getQueuedOfflineSOS();
    let updated: SOSPacket[];

    if (typeof packetOrId === "object") {
      const fullPacket = packetOrId;
      updated = current.map((p) =>
        p.sos_id === fullPacket.sos_id ? fullPacket : p
      );
    } else {
      const id = packetOrId;
      updated = current.map((p) =>
        p.sos_id === id ? ({ ...p, ...updates } as SOSPacket) : p
      );
    }

    localStorage.setItem("tp_offline_sos", JSON.stringify(updated));

    const db = await openDatabase();
    const tx = db.transaction(STORE_SOS, "readwrite");
    const store = tx.objectStore(STORE_SOS);
    const targetId = typeof packetOrId === "object" ? packetOrId.sos_id : packetOrId;
    const found = updated.find((p) => p.sos_id === targetId);
    if (found) store.put(found);
  } catch (err) {
    console.debug("IndexedDB update SOS error:", err);
  }
}

export async function clearSyncedOfflineSOS(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    const current = await getQueuedOfflineSOS();
    const pending = current.filter((p) => p.mesh.sync_status !== "SYNCED_COMMAND");
    localStorage.setItem("tp_offline_sos", JSON.stringify(pending));

    const db = await openDatabase();
    const tx = db.transaction(STORE_SOS, "readwrite");
    const store = tx.objectStore(STORE_SOS);
    store.clear();
    for (const p of pending) {
      store.put(p);
    }
  } catch (err) {
    console.debug("IndexedDB clear synced SOS error:", err);
  }
}
