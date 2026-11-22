import { NextResponse } from "next/server";
import { triggerServerRainfall } from "@/lib/serverState";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const rate = Number(body.rainfall_mm_hr) || 45.0;
    const store = triggerServerRainfall(rate);
    return NextResponse.json({
      ...store,
      connection: "api",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
