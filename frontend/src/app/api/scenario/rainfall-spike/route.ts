import { NextResponse } from "next/server";
import { SEEDED_BASIN_FEATURES, SEEDED_DISPATCHES } from "@/lib/offlineStore";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rate = body.rainfall_mm_hr ?? 45.0;
    return NextResponse.json({
      mode: "NORMAL",
      features: SEEDED_BASIN_FEATURES,
      payload_kb: 44.1,
      sos_packets: [],
      dispatches: SEEDED_DISPATCHES,
      kpis: {
        total_features: 45,
        active_sos_count: 0,
        critical_sos_count: 0,
        open_corridors_count: 3,
        submerged_roads_count: 2,
        active_shelters_count: 4,
        safe_shelters_count: 4,
        operational_hospitals_count: 2,
        payload_kb: 44.1,
        cellular_online: true,
        navic_locked: true,
        lora_mesh_active: false,
        max_rainfall_mm_hr: rate,
        max_water_depth_m: 1.8,
        heavy_rain_alerts: 5,
        flooded_area_km2: 3.6,
        people_at_risk: 142000,
        active_alerts: 9,
        active_mesh_relays: 0,
      },
      last_updated: new Date().toISOString(),
      connection: "api",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
