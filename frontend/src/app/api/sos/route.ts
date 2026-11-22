import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const packet = await req.json();
    if (Array.isArray(packet)) {
      const synced = packet.map((p) => ({
        ...p,
        mesh: { ...p.mesh, sync_status: "SYNCED_COMMAND" },
      }));
      return NextResponse.json(synced);
    }
    const synced = {
      ...packet,
      mesh: { ...packet.mesh, sync_status: "SYNCED_COMMAND" },
    };
    return NextResponse.json(synced);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
