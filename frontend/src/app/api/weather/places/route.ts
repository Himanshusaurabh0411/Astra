import { NextResponse } from "next/server";
import { INDIA_REGIONS } from "@/lib/regions";

const PLACES = INDIA_REGIONS.flatMap((region) =>
  region.places.map((place) => ({
    name: place.name,
    state: place.state,
    lat: place.center[1],
    lng: place.center[0],
  }))
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").toLowerCase().trim();
  if (q.length < 2) {
    return NextResponse.json(PLACES.slice(0, 10));
  }
  const filtered = PLACES.filter((p) =>
    p.name.toLowerCase().includes(q) || p.state.toLowerCase().includes(q)
  );
  return NextResponse.json(filtered.length ? filtered : PLACES.slice(0, 5));
}
