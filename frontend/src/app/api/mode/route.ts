import { NextResponse } from "next/server";
import { setServerMode } from "@/lib/serverState";
import type { OperationalMode } from "@/lib/terrapulseClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(req: Request) {
  try {
    const { mode } = await req.json().catch(() => ({ mode: "NORMAL" }));
    const currentMode = (mode || "NORMAL") as OperationalMode;
    const store = setServerMode(currentMode);
    return NextResponse.json(
      {
        ...store,
        connection: "api",
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
