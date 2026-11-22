/**
 * TerraPulse Universal Client Module
 * REST API client & resilient auto-reconnecting WebSocket feed for Central Command
 */

export type OperationalMode = "NORMAL" | "CELL_BLACKOUT_MESH_ACTIVE" | "BACKHAUL_SYNC";
export type ScenarioMode = "BASELINE" | "MOSDAC_RAIN_ALERT" | "BHOONIDHI_SAR_INUNDATION" | "VEDAS_DEM_CORRIDORS" | "TELECOM_BLACKOUT_MESH";
export type SpatialLayer = "mosdac_rain" | "bhoonidhi_flood" | "vedas_roads" | "vedas_corridors" | "bhuvan_assets";
export type HazardSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type RoadStatus = "OPEN" | "SUBMERGED" | "CORRIDOR" | "NA";
export type AssetType = "HOSPITAL" | "SCHOOL" | "GRAM_PANCHAYAT" | "SHELTER" | "RESERVOIR" | "NONE";

export interface GeoJsonMetadata {
  source_portal: string;
  generated_at: string;
  payload_kb: number;
  scenario_mode: ScenarioMode;
  rainfall_threshold_mm_hr: number;
  basin_name?: string;
  bounding_box?: number[];
}

export interface GeoJsonGeometry {
  type: "Polygon" | "MultiPolygon" | "LineString" | "Point";
  coordinates: any;
}

export interface GeoJsonFeatureProperties {
  layer: SpatialLayer;
  title: string;
  hazard_type: string;
  severity: HazardSeverity;
  rainfall_mm_hr: number;
  water_depth_m: number;
  road_status: RoadStatus;
  asset_type: AssetType;
  evacuation_priority: number;
  recommended_action: string;
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
  metadata: GeoJsonMetadata;
  features: GeoJsonFeature[];
}

export interface PositionModel {
  lat: number;
  lng: number;
  accuracy_m: number;
  navic_band: string;
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
  sync_status: "QUEUED_OFFLINE" | "RELAYED_MESH" | "SYNCED_COMMAND";
}

export interface SOSPacket {
  sos_id: string;
  device_id: string;
  timestamp: string;
  position: PositionModel;
  triage: TriageModel;
  mesh: MeshModel;
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

const API_BASE = typeof window !== "undefined" ? "" : (process.env.NEXT_PUBLIC_BACKEND_URL || "http://127.0.0.1:8000");

export async function fetchState(): Promise<TerraPulseStateResponse> {
  const res = await fetch(`${API_BASE}/api/state`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch state: ${res.statusText}`);
  return res.json();
}

export async function triggerRainfallSpike(multiplier = 4.0, rainfall_mm_hr?: number): Promise<TerraPulseStateResponse> {
  const res = await fetch(`${API_BASE}/api/scenario/rainfall-spike`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ multiplier, rainfall_mm_hr }),
  });
  if (!res.ok) throw new Error(`Rainfall spike failed: ${res.statusText}`);
  return res.json();
}

export async function switchOperationalMode(mode: OperationalMode): Promise<TerraPulseStateResponse> {
  const res = await fetch(`${API_BASE}/api/mode`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) throw new Error(`Mode switch failed: ${res.statusText}`);
  return res.json();
}

export async function pushEvacuationDispatch(payload: {
  target_zone_id: string;
  alert_headline: string;
  safe_asset_name?: string;
  safe_lat?: number;
  safe_lng?: number;
}): Promise<DispatchVector> {
  const res = await fetch(`${API_BASE}/api/dispatch`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Dispatch failed: ${res.statusText}`);
  return res.json();
}

export async function resetScenario(): Promise<TerraPulseStateResponse> {
  const res = await fetch(`${API_BASE}/api/reset`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Reset failed: ${res.statusText}`);
  return res.json();
}

export function subscribeToTelemetry(onEvent: (event: { event: string; data: any; timestamp: string }) => void): () => void {
  if (typeof window === "undefined") return () => {};

  let ws: WebSocket | null = null;
  let retryCount = 0;
  let isUnmounted = false;
  let reconnectTimeout: any = null;

  function connect() {
    if (isUnmounted) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.hostname;
    // In dev, Next rewrites don't always proxy WS, so connect directly to 8000 if running locally
    const port = window.location.port === "3000" ? "8000" : window.location.port;
    const wsUrl = `${protocol}//${host}:${port}/ws/live`;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        retryCount = 0;
        console.log("🛰️ [TerraPulse WS] Connected to Central Command Telemetry Feed");
      };

      ws.onmessage = (msg) => {
        try {
          const parsed = JSON.parse(msg.data);
          onEvent(parsed);
        } catch (e) {
          console.debug("WS raw text:", msg.data);
        }
      };

      ws.onerror = (err) => {
        console.warn("WS error, will reconnect:", err);
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
        retryCount++;
        reconnectTimeout = setTimeout(connect, delay);
      };
    } catch (e) {
      const delay = Math.min(1000 * Math.pow(1.5, retryCount), 10000);
      retryCount++;
      reconnectTimeout = setTimeout(connect, delay);
    }
  }

  connect();

  return () => {
    isUnmounted = true;
    if (reconnectTimeout) clearTimeout(reconnectTimeout);
    if (ws) ws.close();
  };
}
