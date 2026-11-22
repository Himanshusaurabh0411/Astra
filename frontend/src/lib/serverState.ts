import { SEEDED_BASIN_FEATURES, SEEDED_DISPATCHES } from "@/lib/offlineStore";
import type { DispatchVector, OperationalMode, SOSPacket, TerraPulseStateResponse } from "@/lib/terrapulseClient";

interface ServerStateStore {
  mode: OperationalMode;
  features: typeof SEEDED_BASIN_FEATURES;
  payload_kb: number;
  sos_packets: SOSPacket[];
  dispatches: DispatchVector[];
  kpis: TerraPulseStateResponse["kpis"];
  last_updated: string;
}

const BASELINE_KPIS: TerraPulseStateResponse["kpis"] = {
  total_features: 45,
  active_sos_count: 0,
  critical_sos_count: 0,
  open_corridors_count: 3,
  submerged_roads_count: 1,
  safe_shelters_count: 4,
  payload_kb: 42.5,
  cellular_online: true,
  navic_locked: true,
  lora_mesh_active: false,
  max_rainfall_mm_hr: 18.2,
  max_water_depth_m: 0.6,
  heavy_rain_alerts: 3,
  flooded_area_km2: 2.8,
  people_at_risk: 125000,
  active_alerts: 7,
  active_mesh_relays: 0,
};

// Global in-memory singleton for Next.js server instance
const globalForState = globalThis as unknown as {
  tpServerState?: ServerStateStore;
};

function initStore(): ServerStateStore {
  return {
    mode: "NORMAL",
    features: JSON.parse(JSON.stringify(SEEDED_BASIN_FEATURES)),
    payload_kb: 42.5,
    sos_packets: [],
    dispatches: [...SEEDED_DISPATCHES],
    kpis: { ...BASELINE_KPIS },
    last_updated: new Date().toISOString(),
  };
}

export function getServerStore(): ServerStateStore {
  if (!globalForState.tpServerState) {
    globalForState.tpServerState = initStore();
  }
  return globalForState.tpServerState;
}

export function setServerMode(mode: OperationalMode): ServerStateStore {
  const store = getServerStore();
  store.mode = mode;
  store.last_updated = new Date().toISOString();
  const isBlackout = mode === "CELL_BLACKOUT_MESH_ACTIVE";
  store.kpis = {
    ...store.kpis,
    cellular_online: !isBlackout,
    lora_mesh_active: isBlackout,
    active_mesh_relays: isBlackout ? 6 : 0,
  };
  return store;
}

export function triggerServerRainfall(rate: number): ServerStateStore {
  const store = getServerStore();
  store.last_updated = new Date().toISOString();
  const isHeavy = rate > 15;
  store.kpis = {
    ...store.kpis,
    max_rainfall_mm_hr: rate,
    max_water_depth_m: isHeavy ? Math.min(3.2, 0.5 + rate / 30) : 0.6,
    heavy_rain_alerts: isHeavy ? 6 : 2,
    flooded_area_km2: isHeavy ? 4.2 : 2.8,
    people_at_risk: isHeavy ? 154000 : 125000,
    active_alerts: isHeavy ? 11 : 7,
    submerged_roads_count: isHeavy ? 3 : 1,
  };
  return store;
}

export function addServerDispatch(dispatch: DispatchVector): ServerStateStore {
  const store = getServerStore();
  store.dispatches = [dispatch, ...store.dispatches.filter((d) => d.dispatch_id !== dispatch.dispatch_id)].slice(0, 50);
  store.last_updated = new Date().toISOString();
  store.kpis = {
    ...store.kpis,
    open_corridors_count: Math.max(1, store.kpis.open_corridors_count),
  };
  return store;
}

export function resetServerState(): ServerStateStore {
  globalForState.tpServerState = initStore();
  return globalForState.tpServerState;
}

export function addServerSOS(packet: SOSPacket): ServerStateStore {
  const store = getServerStore();
  store.sos_packets = [packet, ...store.sos_packets.filter((p) => p.sos_id !== packet.sos_id)].slice(0, 50);
  store.last_updated = new Date().toISOString();
  store.kpis = {
    ...store.kpis,
    active_sos_count: store.sos_packets.length,
    critical_sos_count: store.sos_packets.filter((p) => p.triage?.severity === "CRITICAL").length,
  };
  return store;
}

export function resolveServerSOS(id: string): ServerStateStore {
  const store = getServerStore();
  store.sos_packets = store.sos_packets.filter((p) => p.sos_id !== id);
  store.last_updated = new Date().toISOString();
  store.kpis = {
    ...store.kpis,
    active_sos_count: store.sos_packets.length,
    critical_sos_count: store.sos_packets.filter((p) => p.triage?.severity === "CRITICAL").length,
  };
  return store;
}
