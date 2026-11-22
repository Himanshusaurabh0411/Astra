import { NextResponse } from "next/server";
import { SEEDED_BASIN_FEATURES, SEEDED_DISPATCHES } from "@/lib/offlineStore";

export async function POST() {
  return NextResponse.json({
    mode: "NORMAL",
    features: SEEDED_BASIN_FEATURES,
    payload_kb: 42.5,
    sos_packets: [],
    dispatches: SEEDED_DISPATCHES,
    kpis: {
      total_features: 45,
      active_sos_count: 0,
      critical_sos_count: 0,
      open_corridors_count: 3,
      submerged_roads_count: 1,
      active_shelters_count: 4,
      safe_shelters_count: 4,
      operational_hospitals_count: 2,
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
    },
    last_updated: new Date().toISOString(),
    connection: "api",
  });
}
