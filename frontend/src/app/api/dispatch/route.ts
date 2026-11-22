import { NextResponse } from "next/server";
import { SEEDED_DISPATCHES } from "@/lib/offlineStore";

export async function GET() {
  return NextResponse.json(SEEDED_DISPATCHES);
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const targetRegion = body.region && body.region !== "all-india" ? body.region : "central-india";
    const path = body.corridor_coordinates ?? [
      [77.05, 23.18], [77.12, 23.20], [77.18, 23.22], [77.215, 23.238]
    ];
    const data = {
      dispatch_id: `DSP-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 1000)}`,
      issued_at: new Date().toISOString(),
      mode: body.mode ?? "NORMAL",
      target_zone_id: body.target_zone_id ?? targetRegion,
      alert_headline: body.alert_headline ?? "Follow marked higher-ground corridor to verified relief shelter.",
      safe_asset: {
        name: body.safe_asset_name ?? "Kothri Kalan Community Relief Centre",
        lat: body.safe_lat ?? 23.238,
        lng: body.safe_lng ?? 77.215,
      },
      evacuation_corridor: { type: "LineString", coordinates: path },
      payload_kb: 1.2,
      saved_locally: true,
    };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
