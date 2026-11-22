import { NextResponse } from "next/server";
import { addServerDispatch, getServerStore } from "@/lib/serverState";
import type { DispatchVector } from "@/lib/terrapulseClient";

export async function GET() {
  const store = getServerStore();
  return NextResponse.json(store.dispatches);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetRegion = body.region && body.region !== "all-india" ? body.region : "central-india";
    
    // Region-specific high-ground evacuation corridors and verified relief centers
    let safeName = body.safe_asset_name;
    let safeLat = body.safe_lat;
    let safeLng = body.safe_lng;
    let path = body.corridor_coordinates;

    if (!path || !safeName) {
      if (targetRegion === "brahmaputra" || targetRegion.includes("assam")) {
        safeName = safeName ?? "Chandrapur High-Ground Evacuation Shelter (Guwahati)";
        safeLng = safeLng ?? 91.920;
        safeLat = safeLat ?? 26.190;
        path = path ?? [
          [91.740, 26.140], [91.810, 26.160], [91.870, 26.180], [91.920, 26.190]
        ];
      } else if (targetRegion === "western-ghats" || targetRegion.includes("wayanad")) {
        safeName = safeName ?? "Vythiri High-Elevation Relief Command Center (Wayanad)";
        safeLng = safeLng ?? 76.040;
        safeLat = safeLat ?? 11.550;
        path = path ?? [
          [76.130, 11.500], [76.090, 11.520], [76.060, 11.540], [76.040, 11.550]
        ];
      } else {
        safeName = safeName ?? "Kothri Kalan Community Relief Centre";
        safeLng = safeLng ?? 77.215;
        safeLat = safeLat ?? 23.238;
        path = path ?? [
          [77.05, 23.18], [77.12, 23.20], [77.18, 23.22], [77.215, 23.238]
        ];
      }
    }

    const data: DispatchVector = {
      dispatch_id: `DSP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      issued_at: new Date().toISOString(),
      mode: body.mode ?? getServerStore().mode,
      target_zone_id: targetRegion,
      alert_headline: body.alert_headline ?? `Follow marked higher-ground corridor to ${safeName}.`,
      safe_asset: {
        name: safeName,
        lat: safeLat,
        lng: safeLng,
      },
      evacuation_corridor: { type: "LineString", coordinates: path },
      payload_kb: 1.2,
      saved_locally: true,
    };
    addServerDispatch(data);
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
