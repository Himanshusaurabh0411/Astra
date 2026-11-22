import { NextResponse } from "next/server";
import { setServerMode } from "@/lib/serverState";
import type { OperationalMode } from "@/lib/terrapulseClient";

export async function POST(req: Request) {
  try {
    const { mode } = await req.json().catch(() => ({ mode: "NORMAL" }));
    const currentMode = (mode || "NORMAL") as OperationalMode;
    const store = setServerMode(currentMode);
    return NextResponse.json({
      ...store,
      connection: "api",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
