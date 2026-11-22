import { NextResponse } from "next/server";
import { addServerSOS, getServerStore } from "@/lib/serverState";
import type { SOSPacket } from "@/lib/terrapulseClient";

export async function GET() {
  const store = getServerStore();
  return NextResponse.json(store.sos_packets);
}

export async function POST(req: Request) {
  try {
    const packet = await req.json();
    if (Array.isArray(packet)) {
      const synced = packet.map((p) => {
        const item: SOSPacket = {
          ...p,
          mesh: { ...p.mesh, sync_status: "SYNCED_COMMAND" },
        };
        addServerSOS(item);
        return item;
      });
      return NextResponse.json(synced);
    }
    const synced: SOSPacket = {
      ...packet,
      mesh: { ...packet.mesh, sync_status: "SYNCED_COMMAND" },
    };
    addServerSOS(synced);
    return NextResponse.json({
      ...synced,
      email_notification: { status: "SENT_MOCK", recipient: "control@ndrf.gov.in" },
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
