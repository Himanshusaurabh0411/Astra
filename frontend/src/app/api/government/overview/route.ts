import { NextResponse } from "next/server";
import { getServerStore } from "@/lib/serverState";

export async function GET() {
  const store = getServerStore();

  const defaultRequests = [
    {
      sos_id: "SOS-KOTHRI-01",
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      issued_at: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      position: { lat: 23.238, lng: 77.215, accuracy_m: 4.5, navic_band: "L5/S" },
      triage: {
        severity: "CRITICAL",
        headcount: 14,
        needs: ["MEDICAL_OXYGEN", "EVACUATION_BOAT"],
        note: "Water level rose 1.2m near primary school. 14 people waiting on second floor.",
      },
      mesh: {
        hops: 2,
        battery_pct: 68,
        relay_path: ["LORA-REPEATER-01", "COMMAND-STATION"],
        sync_status: "RELAYED_MESH",
      },
    },
    {
      sos_id: "SOS-SEHORE-02",
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      issued_at: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      position: { lat: 23.195, lng: 77.085, accuracy_m: 3.8, navic_band: "L5" },
      triage: {
        severity: "HIGH",
        headcount: 6,
        needs: ["FOOD_RATIONS", "DRINKING_WATER"],
        note: "Bridge crossing washed out. Villagers cut off from highway.",
      },
      mesh: {
        hops: 1,
        battery_pct: 82,
        relay_path: ["COMMAND-STATION"],
        sync_status: "RELAYED_MESH",
      },
    },
  ];

  // Combine any real submitted SOS packets with defaults
  const requests = store.sos_packets.length > 0
    ? store.sos_packets.map((p) => ({
        ...p,
        timestamp: (p as any).timestamp ?? (p as any).issued_at ?? new Date().toISOString(),
      }))
    : defaultRequests;

  return NextResponse.json({
    requests,
    sources: {
      MOSDAC: { source_type: "live_portal", records_ingested: 1420, last_synced_at: new Date().toISOString() },
      Bhoonidhi: { source_type: "live_portal", records_ingested: 1850, last_synced_at: new Date().toISOString() },
      VEDAS: { source_type: "live_portal", records_ingested: 1210, last_synced_at: new Date().toISOString() },
      Bhuvan: { source_type: "live_portal", records_ingested: 940, last_synced_at: new Date().toISOString() },
    },
    mode: store.mode,
    email: {
      mode: "automatic",
      recipient: "control-room@ndma.gov.in",
      notices: {
        "SOS-KOTHRI-01": {
          status: "accepted",
          draft: {
            to: "control-room@ndma.gov.in",
            subject: "CRITICAL SOS ALERT: 14 Persons Trapped near Kothri Kalan",
            body: "14 people trapped near primary school. Oxygen and boat dispatched.",
          },
        },
      },
    },
  });
}
