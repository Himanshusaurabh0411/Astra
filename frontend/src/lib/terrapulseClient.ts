import {
  getCachedDispatches, getCachedMap, getQueuedOfflineSOS, queueOfflineSOS, removeQueuedSOS,
  saveCachedDispatches, saveCachedFeatures, SEEDED_BASIN_FEATURES, SEEDED_DISPATCHES,
} from "./offlineStore";
import { distanceKm, getRegion, INDIA, inBounds, nearestRegion, REGIONS, type Bounds, type Point, type Region } from "./regions";

export type OperationalMode = "NORMAL" | "CELL_BLACKOUT_MESH_ACTIVE" | "BACKHAUL_SYNC";
export type HazardSeverity = "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
export type RoadStatus = "OPEN" | "SUBMERGED" | "CORRIDOR" | "NA";
export type AssetType = "HOSPITAL" | "SCHOOL" | "GRAM_PANCHAYAT" | "SHELTER" | "RESERVOIR" | "NONE";
export type SpatialLayer = "mosdac_rain" | "bhoonidhi_flood" | "vedas_roads" | "vedas_corridors" | "bhuvan_assets";
export type SourceType = "live_portal" | "local_sample" | "seed_fallback";
type Connection = "api" | "cache" | "demo";

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
export interface SOSEmailNotice {
  status: "manual" | "queued" | "sending" | "accepted" | "failed" | "uncertain" | "cancelled";
  draft?: { to: string; subject: string; body: string };
}
export interface SOSReceipt extends SOSPacket { email_notification?: SOSEmailNotice }
export type GeoJsonGeometry =
  | { type: "Point"; coordinates: Point }
  | { type: "LineString"; coordinates: Point[] }
  | { type: "Polygon"; coordinates: Point[][] }
  | { type: "MultiPolygon"; coordinates: Point[][][] };

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
  region_id?: string;
  source_portal?: string;
  data_source_origin?: SourceType | "simulation_spike";
  place_name?: string;
  observed_at?: string;
  area_km2?: number;
  water_detected?: boolean;
  wind_km_hr?: number;
  soil_moisture_pct?: number;
  storage_pct?: number;
  capacity_mcm?: number;
  crop_stress_pct?: number;
  record_kind?: string;
  boundary_type?: string;
  land_use?: string;
  slope_pct?: number;
}
export interface GeoJsonFeature {
  type: "Feature";
  id?: string;
  geometry: GeoJsonGeometry;
  properties: GeoJsonFeatureProperties;
}
export interface PortalProvenance {
  source_type: SourceType;
  records_ingested: number;
  last_synced_at: string;
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
    region_id?: string;
    truncated?: boolean;
    total_records?: number;
    portal_provenance?: Record<string, PortalProvenance>;
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
  saved_locally?: boolean;
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
  heavy_rain_alerts: number;
  flooded_area_km2: number;
  people_at_risk: number;
  active_alerts: number;
  active_mesh_relays: number;
}
export interface TerraPulseStateResponse {
  mode: OperationalMode;
  features: GeoJsonFeatureCollection;
  payload_kb: number;
  sos_packets: SOSPacket[];
  dispatches: DispatchVector[];
  kpis: StateSummaryKPIs;
  last_updated: string;
  connection?: Connection;
}

export interface StateFilter { region?: string; bbox?: Bounds }
export interface DispatchRequest {
  target_zone_id?: string;
  alert_headline?: string;
  safe_asset_name?: string;
  safe_lat?: number;
  safe_lng?: number;
  corridor_coordinates?: Point[];
  corridor_id?: string;
  region?: string;
}

const DEMO_TIME = "2026-11-21T18:00:00Z";
const seedSos: SOSPacket[] = [
  { sos_id: "SOS-20261121-0042", device_id: "FIELD-409B", timestamp: DEMO_TIME,
    position: { lng: 77.058, lat: 23.091, accuracy_m: 3.5, navic_band: "L5+S_PASSIVE" },
    triage: { severity: "CRITICAL", headcount: 4, needs: ["MEDICAL", "BOAT_RESCUE"] },
    mesh: { transport: "LORA_865", hop_count: 2, max_hops: 7, relay_path: ["Hop 1", "Hop 2"], sync_status: "RELAYED_MESH" } },
  { sos_id: "SOS-20261121-0089", device_id: "FIELD-112A", timestamp: DEMO_TIME,
    position: { lng: 77.032, lat: 23.084, accuracy_m: 4.2, navic_band: "L5+S_PASSIVE" },
    triage: { severity: "MODERATE", headcount: 7, needs: ["WATER", "FOOD"] },
    mesh: { transport: "BLE_MESH", hop_count: 1, max_hops: 7, relay_path: ["Hop 1"], sync_status: "QUEUED_OFFLINE" } },
];

export function featurePoints(geometry: GeoJsonGeometry): Point[] {
  switch (geometry.type) {
    case "Point": return [geometry.coordinates];
    case "LineString": return geometry.coordinates;
    case "Polygon": return geometry.coordinates.flat();
    case "MultiPolygon": return geometry.coordinates.flat(2);
  }
}

export function featurePoint(feature: GeoJsonFeature): Point {
  const coords = featurePoints(feature.geometry);
  return coords[Math.floor(coords.length / 2)] ?? INDIA.center;
}

export function featureRegion(feature: GeoJsonFeature): Region {
  return feature.properties.region_id ? getRegion(feature.properties.region_id) : nearestRegion(featurePoint(feature));
}

function polygonArea(rings: Point[][]): number {
  return rings.reduce((area, ring, index) => {
    const origin = ring[0];
    if (!origin || ring.length < 4) return area;
    let sum = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [x, y] = ring[i];
      const [nextX, nextY] = ring[i + 1];
      sum += (x - origin[0]) * (nextY - origin[1]) - (nextX - origin[0]) * (y - origin[1]);
    }
    return area + Math.abs(sum) * 6196 * Math.cos(origin[1] * Math.PI / 180) * (index ? -1 : 1);
  }, 0);
}

function floodArea(feature: GeoJsonFeature): number {
  const { geometry, properties } = feature;
  if (!(properties.water_depth_m || properties.water_detected)) return 0;
  if (properties.area_km2 !== undefined) return properties.area_km2;
  if (geometry.type === "Polygon") return polygonArea(geometry.coordinates);
  return geometry.type === "MultiPolygon" ? geometry.coordinates.reduce((sum, rings) => sum + polygonArea(rings), 0) : 0;
}

function kpis(state: Pick<TerraPulseStateResponse, "features" | "sos_packets" | "mode" | "payload_kb">): StateSummaryKPIs {
  const features = state.features.features;
  const rain = features.filter((f) => f.properties.layer === "mosdac_rain").map((f) => f.properties.rainfall_mm_hr ?? 0);
  const flood = features.filter((f) => f.properties.layer === "bhoonidhi_flood");
  const blocked = features.filter((f) => f.properties.road_status === "SUBMERGED").length;
  const heavy = rain.filter((rate) => rate > (state.features.metadata.rainfall_threshold_mm_hr ?? 15)).length;
  const mesh = state.mode !== "NORMAL";
  return {
    total_features: features.length,
    active_sos_count: state.sos_packets.length,
    critical_sos_count: state.sos_packets.filter((p) => p.triage.severity === "CRITICAL").length,
    submerged_roads_count: blocked,
    open_corridors_count: features.filter((f) => f.properties.road_status === "CORRIDOR").length,
    safe_shelters_count: features.filter((f) => f.properties.asset_type === "SHELTER").length,
    payload_kb: state.payload_kb,
    cellular_online: state.mode !== "CELL_BLACKOUT_MESH_ACTIVE",
    navic_locked: true,
    lora_mesh_active: mesh,
    max_rainfall_mm_hr: Math.max(0, ...rain),
    max_water_depth_m: Math.max(0, ...flood.map((f) => f.properties.water_depth_m ?? 0)),
    heavy_rain_alerts: heavy,
    flooded_area_km2: Math.round(flood.reduce((sum, f) => sum + floodArea(f), 0) * 100) / 100,
    people_at_risk: state.sos_packets.reduce((sum, p) => sum + p.triage.headcount, 0),
    active_alerts: heavy + blocked + flood.filter((f) => (f.properties.water_depth_m ?? 0) >= .5 || f.properties.water_detected).length,
    active_mesh_relays: mesh ? new Set(state.sos_packets.flatMap((p) => p.mesh.relay_path)).size : 0,
  };
}

function localSeed(): TerraPulseStateResponse {
  const state = {
    mode: "NORMAL" as const,
    features: SEEDED_BASIN_FEATURES,
    payload_kb: new TextEncoder().encode(JSON.stringify(SEEDED_BASIN_FEATURES)).length / 1000,
    sos_packets: seedSos,
    dispatches: SEEDED_DISPATCHES,
    last_updated: DEMO_TIME,
    connection: "demo" as const,
  };
  return { ...state, kpis: kpis(state) };
}

let localState = localSeed();
let fetched = false;
let fetchGeneration = 0;
let pendingSnapshot: Promise<TerraPulseStateResponse> | undefined;
let pendingSosSync: Promise<SOSReceipt[]> | undefined;

export function compileLocalState() {
  return localState;
}

export function scopeState(state: TerraPulseStateResponse, filter: StateFilter = {}): TerraPulseStateResponse {
  const { region, bbox } = filter;
  if ((!region || region === INDIA.id) && !bbox) return state;
  const selected = getRegion(region);
  const pointsMatch = (coords: Point[]) => {
    if (!bbox || coords.some((point) => inBounds(point, bbox))) return true;
    return !!coords.length && Math.min(...coords.map(([x]) => x)) <= bbox[2]
      && Math.max(...coords.map(([x]) => x)) >= bbox[0]
      && Math.min(...coords.map(([, y]) => y)) <= bbox[3]
      && Math.max(...coords.map(([, y]) => y)) >= bbox[1];
  };
  const features: GeoJsonFeatureCollection = {
    ...state.features,
    metadata: { ...state.features.metadata, region_id: selected.id, bounding_box: bbox ?? selected.bbox },
    features: state.features.features.filter((f) =>
      (selected.id === INDIA.id || featureRegion(f).id === selected.id) && pointsMatch(featurePoints(f.geometry))),
  };
  const pointFilter = ({ lat, lng }: { lat: number; lng: number }) =>
    inBounds([lng, lat], selected.bbox) && (!bbox || inBounds([lng, lat], bbox));
  const view = {
    ...state, features,
    sos_packets: state.sos_packets.filter((p) => pointFilter(p.position)),
    dispatches: state.dispatches.filter((d) => pointFilter(d.safe_asset)),
    payload_kb: new TextEncoder().encode(JSON.stringify(features)).length / 1000,
  };
  return { ...view, kpis: kpis(view) };
}

class ApiError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

async function request<T>(path: string, body?: object, timeoutMs = 4500): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const configured = process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "");
    const response = await fetch(`${configured ?? ""}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({})) as { detail?: unknown };
      const detail = typeof error.detail === "string" ? error.detail : "Check the values and try again.";
      throw new ApiError(detail, response.status);
    }
    return await response.json() as T;
  } finally {
    clearTimeout(timer);
  }
}

function remember(state: TerraPulseStateResponse, connection: Connection): TerraPulseStateResponse {
  localState = { ...state, connection };
  fetched = true;
  void saveCachedFeatures(state.features, state.mode);
  void saveCachedDispatches(state.dispatches);
  return localState;
}

function rememberRemote(state: TerraPulseStateResponse): TerraPulseStateResponse {
  fetchGeneration++;
  return remember(state, "api");
}

export async function fetchState(filter: StateFilter = {}): Promise<TerraPulseStateResponse> {
  const custom = !!filter.region || !!filter.bbox;
  if (custom) {
    const query = new URLSearchParams();
    if (filter.region) query.set("region", filter.region);
    if (filter.bbox) query.set("bbox", filter.bbox.join(","));
    try {
      return { ...await request<TerraPulseStateResponse>(`/api/state?${query}`), connection: "api" };
    } catch {
      return scopeState(await fetchState(), filter);
    }
  }
  if (!pendingSnapshot) {
    const version = fetchGeneration;
    pendingSnapshot = (async () => {
      try {
        const data = await request<TerraPulseStateResponse>("/api/state");
        return version === fetchGeneration ? remember(data, "api") : localState;
      } catch {
        if (version !== fetchGeneration) return localState;
        if (!fetched) {
          const [saved, routes] = await Promise.all([getCachedMap(), getCachedDispatches()]);
          if (saved && version === fetchGeneration) {
            const snapshot = { ...localState, features: saved.collection, mode: saved.mode, dispatches: routes };
            localState = { ...snapshot, kpis: kpis(snapshot), connection: "cache" };
            fetched = true;
          }
        } else if (localState.connection === "api") {
          localState = { ...localState, connection: "cache" };
        }
        return localState;
      }
    })().finally(() => { pendingSnapshot = undefined; });
  }
  return pendingSnapshot;
}

export async function fetchRegions(): Promise<Region[]> {
  try {
    return await request<Region[]>("/api/regions");
  } catch {
    return REGIONS;
  }
}

export async function syncPortalData(): Promise<TerraPulseStateResponse> {
  return rememberRemote(await request<TerraPulseStateResponse>("/api/ingest/sync", {}, 20000));
}

function fallbackError(error: unknown) {
  if (error instanceof ApiError && error.status < 500) throw error;
}

function commitLocal(state: TerraPulseStateResponse) {
  fetchGeneration++;
  return remember({ ...state, last_updated: new Date().toISOString(), kpis: kpis(state) }, "cache");
}

export async function triggerRainfallSpike(
  multiplier = 4.5, rainfall_mm_hr?: number, region?: string,
): Promise<TerraPulseStateResponse> {
  try {
    const data = await request<TerraPulseStateResponse>("/api/scenario/rainfall-spike", { multiplier, rainfall_mm_hr, region });
    return !region || region === INDIA.id ? rememberRemote(data) : fetchState();
  } catch (error) {
    fallbackError(error);
    const target = getRegion(region).id === INDIA.id ? "central-india" : getRegion(region).id;
    const rate = rainfall_mm_hr ?? Math.min(250, scopeState(localState, { region: target }).kpis.max_rainfall_mm_hr * multiplier);
    const heavy = rate > (localState.features.metadata.rainfall_threshold_mm_hr ?? 15);
    const depth = heavy ? Math.min(3.2, 0.45 + rate / 34) : 0;
    const features = localState.features.features.map((f): GeoJsonFeature => {
      if (featureRegion(f).id !== target) return f;
      const props = { ...f.properties, data_source_origin: "simulation_spike" as const, observed_at: new Date().toISOString() };
      if (props.layer === "mosdac_rain") {
        props.rainfall_mm_hr = rate;
        props.severity = heavy ? "HIGH" : "LOW";
      }
      if (props.layer === "bhoonidhi_flood") {
        props.water_depth_m = depth;
        props.area_km2 = undefined;
        props.severity = heavy ? "HIGH" : "LOW";
      }
      if (props.layer === "vedas_roads" && f.geometry.type === "LineString") {
        props.road_status = heavy ? "SUBMERGED" : "OPEN";
        props.severity = heavy ? "CRITICAL" : "LOW";
        props.water_depth_m = depth;
      }
      return { ...f, properties: props };
    });
    const collection = { ...localState.features, features };
    return commitLocal({
      ...localState, features: collection,
      payload_kb: new TextEncoder().encode(JSON.stringify(collection)).length / 1000,
    });
  }
}

export async function switchOperationalMode(mode: OperationalMode): Promise<TerraPulseStateResponse> {
  try {
    return rememberRemote(await request<TerraPulseStateResponse>("/api/mode", { mode }));
  } catch (error) {
    fallbackError(error);
    return commitLocal({ ...localState, mode });
  }
}

export async function resetScenario(): Promise<TerraPulseStateResponse> {
  try {
    return rememberRemote(await request<TerraPulseStateResponse>("/api/reset", {}));
  } catch (error) {
    fallbackError(error);
    return commitLocal(localSeed());
  }
}

export function routePair(state: TerraPulseStateResponse, region: string, corridorId?: string, near?: Point) {
  const view = scopeState(state, { region: region === INDIA.id ? "central-india" : region });
  const routes = view.features.features.filter((f) =>
    f.properties.road_status === "CORRIDOR" && f.geometry.type === "LineString" && (!corridorId || f.id === corridorId));
  if (near) routes.sort((a, b) => distanceKm(featurePoint(a), near) - distanceKm(featurePoint(b), near));
  const route = routes[0];
  if (!route || route.geometry.type !== "LineString" || !route.geometry.coordinates.length) return undefined;
  const start = route.geometry.coordinates[0];
  const end = route.geometry.coordinates[route.geometry.coordinates.length - 1];
  const endpointDistance = (f: GeoJsonFeature) => Math.min(distanceKm(featurePoint(f), start), distanceKm(featurePoint(f), end));
  const asset = view.features.features
    .filter((f) => f.properties.asset_type === "SHELTER" && f.geometry.type === "Point")
    .sort((a, b) => endpointDistance(a) - endpointDistance(b))[0];
  if (!asset) return undefined;
  const centre = featurePoint(asset);
  const path = distanceKm(centre, start) < distanceKm(centre, end)
    ? [...route.geometry.coordinates].reverse() : route.geometry.coordinates;
  return { route, asset, path };
}

export async function pushEvacuationDispatch(body: DispatchRequest): Promise<DispatchVector> {
  try {
    const data = await request<DispatchVector>("/api/dispatch", body);
    localState = { ...localState, dispatches: [...localState.dispatches, data].slice(-50) };
    await saveCachedDispatches(localState.dispatches);
    return data;
  } catch (error) {
    fallbackError(error);
    const pair = routePair(localState, body.region ?? INDIA.id, body.corridor_id);
    const [lng, lat] = pair ? featurePoint(pair.asset) : [body.safe_lng, body.safe_lat];
    const path = body.corridor_coordinates ?? pair?.path;
    if (!path || lat === undefined || lng === undefined) throw new Error("This area has no route and shelter pair to share.");
    const data: DispatchVector = {
      dispatch_id: `DSP-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
      issued_at: new Date().toISOString(), mode: localState.mode,
      target_zone_id: body.target_zone_id ?? body.region ?? "central-india",
      alert_headline: body.alert_headline ?? "Follow the marked exercise route to the relief point.",
      safe_asset: { name: body.safe_asset_name ?? pair?.asset.properties.title ?? "Relief point", lat, lng },
      evacuation_corridor: { type: "LineString", coordinates: path },
      payload_kb: 0, saved_locally: true,
    };
    data.payload_kb = (new TextEncoder().encode(JSON.stringify(data)).length + 4) / 1000;
    commitLocal({ ...localState, dispatches: [...localState.dispatches, data].slice(-50) });
    return data;
  }
}

export async function submitSOSPacket(packet: SOSPacket, queueOnly = false): Promise<SOSReceipt> {
  if (!queueOnly && localState.mode !== "CELL_BLACKOUT_MESH_ACTIVE") {
    try {
      const { email_notification, ...saved } = await request<SOSReceipt>("/api/sos", packet);
      localState = { ...localState, sos_packets: [...localState.sos_packets.filter((p) => p.sos_id !== saved.sos_id), saved] };
      return { ...saved, email_notification };
    } catch (error) {
      fallbackError(error);
    }
  }
  await queueOfflineSOS(packet);
  return packet;
}

export async function syncQueuedSOS(): Promise<SOSReceipt[]> {
  if (!pendingSosSync) {
    pendingSosSync = (async () => {
      const queued = await getQueuedOfflineSOS();
      const waiting = queued.filter((packet) => packet.mesh.sync_status !== "SYNCED_COMMAND");
      if (!waiting.length || !navigator.onLine || localState.connection !== "api"
        || localState.mode === "CELL_BLACKOUT_MESH_ACTIVE") return [];
      const received: SOSReceipt[] = [];
      for (let i = 0; i < waiting.length; i += 50) {
        const batch = await request<SOSReceipt[]>("/api/sos", waiting.slice(i, i + 50));
        const acknowledged = batch.filter((p) => p.mesh.sync_status === "SYNCED_COMMAND");
        await removeQueuedSOS(acknowledged.map((p) => p.sos_id));
        received.push(...acknowledged);
      }
      return received;
    })().finally(() => { pendingSosSync = undefined; });
  }
  return pendingSosSync;
}

export async function relaySOSPacket(sosId: string): Promise<SOSPacket> {
  return request<SOSPacket>(`/api/sos/${encodeURIComponent(sosId)}/relay`, {});
}

export async function resolveSOSPacket(sosId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/api/sos/${encodeURIComponent(sosId)}/resolve`, {});
}

interface TelemetryEvent {
  event: string;
  timestamp: string;
  data?: { reason?: string; mode?: OperationalMode; region?: string; destination?: string; sos_id?: string };
}

export function subscribeToTelemetry(callback: (event: TelemetryEvent) => void): () => void {
  let socket: WebSocket | undefined;
  let reconnect: ReturnType<typeof setTimeout>;
  let delay = 1000;
  let stopped = false;
  const notify = (event: string) => callback({ event, timestamp: new Date().toISOString() });

  const connect = () => {
    if (stopped || !navigator.onLine || socket) return;
    const configured = process.env.NEXT_PUBLIC_WS_URL || undefined;
    const url = new URL("/ws/live", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    try {
      socket = new WebSocket(configured ?? url);
      socket.onmessage = ({ data }) => {
        try { callback(JSON.parse(data) as TelemetryEvent); } catch { /* Ignore heartbeat replies. */ }
      };
      socket.onopen = () => { delay = 1000; };
      socket.onclose = () => {
        socket = undefined;
        if (!stopped) {
          reconnect = setTimeout(connect, delay);
          delay = Math.min(delay * 2, 15000);
        }
      };
    } catch {
      // The polling interval still refreshes state.
    }
  };
  const online = () => { notify("online"); connect(); };
  const offline = () => notify("offline");
  const poll = setInterval(() => { if (navigator.onLine) notify("poll_sync"); }, 6500);
  const ping = setInterval(() => { if (socket?.readyState === WebSocket.OPEN) socket.send("ping"); }, 15000);
  window.addEventListener("online", online);
  window.addEventListener("offline", offline);
  connect();
  return () => {
    stopped = true;
    clearInterval(poll);
    clearInterval(ping);
    clearTimeout(reconnect);
    if (socket?.readyState === WebSocket.CONNECTING) socket.onopen = () => socket?.close();
    else socket?.close();
    window.removeEventListener("online", online);
    window.removeEventListener("offline", offline);
  };
}
