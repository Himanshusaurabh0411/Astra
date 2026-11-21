/**
 * TerraPulse Space-to-Ground Geospatial Client & Real-time Telemetry Service
 * Interfaces with FastAPI backend (port 8000) and WebSocket (/ws/live)
 * Includes local in-memory fallback, IndexedDB caching, and automatic exponential backoff.
 */

import {
  getCachedFeatures,
  saveCachedFeatures,
  getCachedDispatches,
  saveCachedDispatches,
  SEEDED_BASIN_FEATURES,
  SEEDED_DISPATCHES,
  queueOfflineSOS,
} from "./offlineStore";

// Operational & Tactical Enums
export type OperationalMode = "NORMAL" | "CELL_BLACKOUT_MESH_ACTIVE" | "BACKHAUL_SYNC";
export type HazardSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type RoadStatus = "OPEN" | "SUBMERGED" | "CORRIDOR" | "NA";
export type AssetType = "HOSPITAL" | "SCHOOL" | "GRAM_PANCHAYAT" | "SHELTER" | "RESERVOIR" | "NONE";
export type SpatialLayer =
  | "mosdac_rain"
  | "bhoonidhi_flood"
  | "vedas_roads"
  | "vedas_corridors"
  | "bhuvan_assets";

export interface PositionModel {
  lat: number;
  lng: number;
  accuracy_m?: number;
  navic_band?: string;
}

export interface TriageModel {
  severity: HazardSeverity;
  headcount: number;
  needs: string[];
  note?: string;
}

export interface MeshModel {
  transport: string;
  hop_count: number;
  max_hops: number;
  relay_path: string[];
  sync_status: string;
}

export interface SOSPacket {
  sos_id: string;
  device_id: string;
  timestamp: string;
  position: PositionModel;
  triage: TriageModel;
  mesh: MeshModel;
}

export interface GeoJsonGeometry {
  type: string;
  coordinates: any;
}

export interface GeoJsonFeatureProperties {
  layer: SpatialLayer;
  title: string;
  hazard_type?: string;
  severity?: HazardSeverity;
  rainfall_mm_hr?: number;
  water_depth_m?: number;
  road_status?: RoadStatus;
  asset_type?: AssetType;
  evacuation_priority?: number;
  recommended_action?: string;
  elevation_m?: number;
  capacity?: number;
  sensor?: string;
  [key: string]: any;
}

export interface GeoJsonFeature {
  type: "Feature";
  id?: string;
  geometry: GeoJsonGeometry;
  properties: GeoJsonFeatureProperties;
}

export interface GeoJsonFeatureCollection {
  type: "FeatureCollection";
  metadata: {
    source_portal?: string;
    generated_at?: string;
    payload_kb?: number;
    scenario_mode?: string;
    rainfall_threshold_mm_hr?: number;
    basin_name?: string;
    bounding_box?: number[];
    [key: string]: any;
  };
  features: GeoJsonFeature[];
}

export interface SafeAsset {
  name: string;
  lat: number;
  lng: number;
  asset_id?: string;
}

export interface DispatchVector {
  dispatch_id: string;
  issued_at: string;
  mode: OperationalMode;
  target_zone_id: string;
  alert_headline: string;
  evacuation_corridor: GeoJsonGeometry;
  safe_asset: SafeAsset;
  payload_kb: number;
}

export interface StateSummaryKPIs {
  total_features: number;
  active_sos_count: number;
  critical_sos_count: number;
  submerged_roads_count: number;
  open_corridors_count: number;
  safe_shelters_count: number;
  payload_kb: number;
  cellular_online: boolean;
  navic_locked: boolean;
  lora_mesh_active: boolean;
  max_rainfall_mm_hr: number;
  max_water_depth_m: number;
}

export interface TerraPulseStateResponse {
  mode: OperationalMode;
  features: GeoJsonFeatureCollection;
  payload_kb: number;
  sos_packets: SOSPacket[];
  dispatches: DispatchVector[];
  kpis: StateSummaryKPIs;
  last_updated: string;
}

// Configurable Host/Port
const API_URL =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `http://${window.location.hostname}:8000`
    : "http://localhost:8000";

const WS_URL =
  typeof window !== "undefined" && window.location.hostname !== "localhost"
    ? `ws://${window.location.hostname}:8000/ws/live`
    : "ws://localhost:8000/ws/live";

// In-Memory Simulated State for Seamless Offline Demonstration
let localMode: OperationalMode = "NORMAL";
let localRainfall = 4.8;
let localWaterDepth = 0.2;
let localFeatures: GeoJsonFeatureCollection = JSON.parse(JSON.stringify(SEEDED_BASIN_FEATURES));
let localDispatches: DispatchVector[] = JSON.parse(JSON.stringify(SEEDED_DISPATCHES));
let localSosPackets: SOSPacket[] = [
  {
    sos_id: "SOS-KOTHRI-409B",
    device_id: "NAVIC-NODE-409B",
    timestamp: new Date().toISOString(),
    position: {
      lat: 23.0910,
      lng: 77.0580,
      accuracy_m: 2.5,
      navic_band: "L5+S_PASSIVE",
    },
    triage: {
      severity: "CRITICAL",
      headcount: 5,
      needs: ["EVACUATION", "MEDICAL", "BOAT_RESCUE"],
      note: "Elderly resident with oxygen cylinder trapped on second floor near Sevan River causeway.",
    },
    mesh: {
      transport: "LORA_865",
      hop_count: 2,
      max_hops: 7,
      relay_path: ["NODE-FIELD-07", "NODE-RIDGE-02", "GATEWAY-CAMP-01"],
      sync_status: "RELAYED_MESH",
    },
  },
  {
    sos_id: "SOS-KOTHRI-512A",
    device_id: "NAVIC-NODE-512A",
    timestamp: new Date().toISOString(),
    position: {
      lat: 23.0840,
      lng: 77.0320,
      accuracy_m: 3.0,
      navic_band: "L5+S_PASSIVE",
    },
    triage: {
      severity: "HIGH",
      headcount: 3,
      needs: ["WATER", "FOOD"],
      note: "Gram Panchayat rooftop shelter muster point; clean drinking water exhausted.",
    },
    mesh: {
      transport: "LORA_865",
      hop_count: 1,
      max_hops: 7,
      relay_path: ["NODE-FIELD-03", "GATEWAY-CAMP-01"],
      sync_status: "RELAYED_MESH",
    },
  },
];

function computeLocalKPIs(): StateSummaryKPIs {
  const submergedRoads = localFeatures.features.filter(
    (f) => f.properties.layer === "vedas_roads" && f.properties.road_status === "SUBMERGED"
  ).length;

  const openCorridors = localFeatures.features.filter(
    (f) => f.properties.layer === "vedas_corridors" && f.properties.road_status === "CORRIDOR"
  ).length;

  const safeShelters = localFeatures.features.filter(
    (f) =>
      f.properties.layer === "bhuvan_assets" &&
      (f.properties.asset_type === "SHELTER" || f.properties.asset_type === "HOSPITAL")
  ).length;

  const criticalSos = localSosPackets.filter((s) => s.triage.severity === "CRITICAL").length;
  const isBlackout = localMode === "CELL_BLACKOUT_MESH_ACTIVE";

  return {
    total_features: localFeatures.features.length,
    active_sos_count: localSosPackets.length,
    critical_sos_count: criticalSos,
    submerged_roads_count: submergedRoads,
    open_corridors_count: openCorridors,
    safe_shelters_count: safeShelters,
    payload_kb: localFeatures.metadata.payload_kb || 14.2,
    cellular_online: !isBlackout,
    navic_locked: true,
    lora_mesh_active: isBlackout,
    max_rainfall_mm_hr: localRainfall,
    max_water_depth_m: localWaterDepth,
  };
}

export function compileLocalState(): TerraPulseStateResponse {
  return {
    mode: localMode,
    features: localFeatures,
    payload_kb: localFeatures.metadata.payload_kb || 14.2,
    sos_packets: localSosPackets,
    dispatches: localDispatches,
    kpis: computeLocalKPIs(),
    last_updated: new Date().toISOString(),
  };
}

// ==============================================================================
// Primary REST API Client with Offline Fallback
// ==============================================================================

export async function fetchState(): Promise<TerraPulseStateResponse> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`${API_URL}/api/state`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      const data: TerraPulseStateResponse = await res.json();
      // Sync local in-memory & IndexedDB cache
      localFeatures = data.features;
      localDispatches = data.dispatches;
      localSosPackets = data.sos_packets;
      localMode = data.mode;
      localRainfall = data.kpis.max_rainfall_mm_hr;
      localWaterDepth = data.kpis.max_water_depth_m;

      saveCachedFeatures(data.features);
      saveCachedDispatches(data.dispatches);
      return data;
    }
  } catch (err) {
    console.debug("Backend unreachable, utilizing local cached state:", err);
  }

  // Load from offline store if available
  const cachedGis = await getCachedFeatures();
  if (cachedGis && cachedGis.features.length > 0) {
    localFeatures = cachedGis;
  }
  const cachedDisps = await getCachedDispatches();
  if (cachedDisps && cachedDisps.length > 0) {
    localDispatches = cachedDisps;
  }

  return compileLocalState();
}

export async function triggerRainfallSpike(
  multiplier: number = 4.5,
  rainfall_mm_hr?: number
): Promise<TerraPulseStateResponse> {
  try {
    const res = await fetch(`${API_URL}/api/scenario/rainfall-spike`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ multiplier, rainfall_mm_hr }),
    });
    if (res.ok) {
      const data = await res.json();
      saveCachedFeatures(data.features);
      return data;
    }
  } catch (err) {
    console.debug("Rainfall spike offline simulation fallback:", err);
  }

  // Local Offline Simulation Cascade
  localRainfall = rainfall_mm_hr || 52.4;
  localWaterDepth = 1.85;

  localFeatures.features = localFeatures.features.map((f) => {
    if (f.properties.layer === "mosdac_rain") {
      return {
        ...f,
        properties: {
          ...f.properties,
          severity: "CRITICAL",
          rainfall_mm_hr: localRainfall,
          recommended_action: "MOSDAC CONVECTIVE SURGE ALERT: Rain exceeds 15 mm/hr threshold. Auto-tasking Bhoonidhi SAR.",
        },
      };
    }
    if (f.properties.layer === "bhoonidhi_flood") {
      return {
        ...f,
        properties: {
          ...f.properties,
          severity: "CRITICAL",
          water_depth_m: localWaterDepth,
          recommended_action: "EOS-04 C-band SAR radar backscatter drop (<-16.5 dB). Sevan River inundation mapped.",
        },
      };
    }
    if (f.id === "VEDAS-ROAD-CAUSEWAY-02") {
      return {
        ...f,
        properties: {
          ...f.properties,
          road_status: "SUBMERGED",
          severity: "CRITICAL",
          water_depth_m: 0.95,
          recommended_action: "ROAD CLOSED: Causeway submerged (+0.95m). Reroute all rescue boats to SH-18 ridge corridor.",
        },
      };
    }
    if (f.properties.layer === "vedas_corridors") {
      return {
        ...f,
        properties: {
          ...f.properties,
          road_status: "CORRIDOR",
          severity: "LOW",
          recommended_action: "SAFE DRY CORRIDOR ACTIVE: Ridge crest road elevation 514m AMSL remains above flood crest.",
        },
      };
    }
    return f;
  });

  localFeatures.metadata.scenario_mode = "MOSDAC_RAIN_ALERT";
  saveCachedFeatures(localFeatures);
  return compileLocalState();
}

export async function switchOperationalMode(
  mode: OperationalMode
): Promise<TerraPulseStateResponse> {
  try {
    const res = await fetch(`${API_URL}/api/mode`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (err) {
    console.debug("Mode switch offline fallback:", err);
  }

  localMode = mode;
  return compileLocalState();
}

export async function pushEvacuationDispatch(payload: {
  target_zone_id?: string;
  alert_headline?: string;
  safe_asset_name?: string;
  safe_lat?: number;
  safe_lng?: number;
}): Promise<DispatchVector> {
  try {
    const res = await fetch(`${API_URL}/api/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data: DispatchVector = await res.json();
      localDispatches = [data, ...localDispatches];
      saveCachedDispatches(localDispatches);
      return data;
    }
  } catch (err) {
    console.debug("Dispatch push offline fallback:", err);
  }

  const newDispatch: DispatchVector = {
    dispatch_id: `DSP-${Math.floor(1000 + Math.random() * 9000)}`,
    issued_at: new Date().toISOString(),
    mode: localMode,
    target_zone_id: payload.target_zone_id || "ZONE-KOTHRI-KALAN",
    alert_headline:
      payload.alert_headline ||
      "EVACUATION DIRECTIVE: Causeway impassable. Move via SH-18 ridge bypass toward VIT Relief Shelter.",
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
      name: payload.safe_asset_name || "VIT Bhopal Auditorium & Relief Shelter",
      lat: payload.safe_lat || 23.0805,
      lng: payload.safe_lng || 77.0160,
    },
    payload_kb: 1.45,
  };

  localDispatches = [newDispatch, ...localDispatches];
  saveCachedDispatches(localDispatches);
  return newDispatch;
}

export async function resetScenario(): Promise<TerraPulseStateResponse> {
  try {
    const res = await fetch(`${API_URL}/api/reset`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      saveCachedFeatures(data.features);
      saveCachedDispatches(data.dispatches);
      return data;
    }
  } catch (err) {
    console.debug("Reset offline fallback:", err);
  }

  localMode = "NORMAL";
  localRainfall = 4.8;
  localWaterDepth = 0.2;
  localFeatures = JSON.parse(JSON.stringify(SEEDED_BASIN_FEATURES));
  localDispatches = JSON.parse(JSON.stringify(SEEDED_DISPATCHES));
  saveCachedFeatures(localFeatures);
  saveCachedDispatches(localDispatches);

  return compileLocalState();
}

export async function submitSOSPacket(packet: SOSPacket): Promise<SOSPacket> {
  try {
    const res = await fetch(`${API_URL}/api/sos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(packet),
    });
    if (res.ok) {
      const saved: SOSPacket = await res.json();
      localSosPackets = [saved, ...localSosPackets.filter((p) => p.sos_id !== saved.sos_id)];
      return saved;
    }
  } catch (err) {
    console.debug("Backend unreachable, queueing SOS packet locally:", err);
  }

  // Queue locally
  await queueOfflineSOS(packet);
  localSosPackets = [packet, ...localSosPackets.filter((p) => p.sos_id !== packet.sos_id)];
  return packet;
}

export async function relaySOSPacket(sosId: string): Promise<SOSPacket> {
  try {
    const res = await fetch(`${API_URL}/api/sos/${sosId}/relay`, { method: "POST" });
    if (res.ok) return await res.json();
  } catch (err) {
    console.debug("Relay offline fallback:", err);
  }

  const existing = localSosPackets.find((p) => p.sos_id === sosId);
  if (existing) {
    existing.mesh.hop_count += 1;
    existing.mesh.relay_path.push(`NODE-HOP-${existing.mesh.hop_count}`);
    existing.mesh.sync_status = "RELAYED_MESH";
    return existing;
  }
  throw new Error("SOS packet not found");
}

export async function resolveSOSPacket(sosId: string): Promise<{ status: string }> {
  try {
    const res = await fetch(`${API_URL}/api/sos/${sosId}/resolve`, { method: "POST" });
    if (res.ok) return await res.json();
  } catch (err) {
    console.debug("Resolve offline fallback:", err);
  }

  localSosPackets = localSosPackets.filter((p) => p.sos_id !== sosId);
  return { status: "RESOLVED" };
}

// ==============================================================================
// Real-time Telemetry Service: WS with Exponential Backoff + Polling Fallback
// ==============================================================================

type TelemetryCallback = (event: { event: string; data?: any; timestamp: string }) => void;

class TelemetryService {
  private ws: WebSocket | null = null;
  private subscribers: Set<TelemetryCallback> = new Set();
  private retryDelayMs = 1000;
  private maxRetryDelayMs = 15000;
  private reconnectTimer: any = null;
  private pollingTimer: any = null;
  private pingInterval: any = null;
  private isDestroyed = false;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window === "undefined") return;
    this.connectWs();
    this.startPollingFallback();
  }

  private connectWs() {
    if (this.isDestroyed || typeof window === "undefined") return;

    try {
      this.ws = new WebSocket(WS_URL);

      this.ws.onopen = () => {
        this.retryDelayMs = 1000;
        this.startHeartbeat();
        this.notify({ event: "connected", timestamp: new Date().toISOString() });
      };

      this.ws.onmessage = (event) => {
        try {
          if (event.data === "pong") return;
          const parsed = JSON.parse(event.data);
          this.notify(parsed);
        } catch {
          // non-json
        }
      };

      this.ws.onerror = () => {
        // silently handled in onclose
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        this.scheduleReconnect();
      };
    } catch {
      this.scheduleReconnect();
    }
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send("ping");
      }
    }, 15000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.connectWs();
      this.retryDelayMs = Math.min(this.retryDelayMs * 1.6, this.maxRetryDelayMs);
    }, this.retryDelayMs);
  }

  // Lightweight 6-second polling fallback so multiple tabs remain synchronized
  private startPollingFallback() {
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.pollingTimer = setInterval(async () => {
      if (this.subscribers.size > 0) {
        try {
          const state = await fetchState();
          this.notify({
            event: "poll_sync",
            data: state,
            timestamp: new Date().toISOString(),
          });
        } catch {}
      }
    }, 6000);
  }

  private notify(evt: { event: string; data?: any; timestamp: string }) {
    this.subscribers.forEach((cb) => {
      try {
        cb(evt);
      } catch (e) {
        console.error("Telemetry listener error:", e);
      }
    });
  }

  public subscribe(cb: TelemetryCallback): () => void {
    this.subscribers.add(cb);
    return () => {
      this.subscribers.delete(cb);
    };
  }

  public destroy() {
    this.isDestroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.pollingTimer) clearInterval(this.pollingTimer);
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {}
    }
    this.subscribers.clear();
  }
}

let globalTelemetry: TelemetryService | null = null;

export function subscribeToTelemetry(callback: TelemetryCallback): () => void {
  if (typeof window === "undefined") return () => {};
  if (!globalTelemetry) {
    globalTelemetry = new TelemetryService();
  }
  return globalTelemetry.subscribe(callback);
}
