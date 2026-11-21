"use client";

import React, { useState, useEffect } from "react";
import {
  Radio,
  Send,
  RefreshCw,
  AlertOctagon,
  Users,
  Layers,
  CheckCircle2,
  Clock,
  ArrowRight,
  Wifi,
  WifiOff,
  Share2,
} from "lucide-react";
import {
  SOSPacket,
  HazardSeverity,
  PositionModel,
  TriageModel,
  MeshModel,
} from "@/lib/terrapulseClient";
import {
  queueOfflineSOS,
  getQueuedOfflineSOS,
  updateQueuedOfflineSOS,
  NavicFixData,
} from "@/lib/offlineStore";

interface LoraMeshPanelProps {
  navicFix: NavicFixData | null;
  onPacketQueued?: (packet: SOSPacket) => void;
  className?: string;
}

const NEED_OPTIONS = [
  { id: "EVACUATION", label: "Evacuation Rescue" },
  { id: "MEDICAL", label: "Medical Trauma/Aid" },
  { id: "BOAT_RESCUE", label: "Rescue Boat Needed" },
  { id: "WATER", label: "Potable Water" },
  { id: "FOOD", label: "Ration Packets" },
];

export default function LoraMeshPanel({
  navicFix,
  onPacketQueued,
  className = "",
}: LoraMeshPanelProps) {
  const [severity, setSeverity] = useState<HazardSeverity>("CRITICAL");
  const [headcount, setHeadcount] = useState(4);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(["EVACUATION", "MEDICAL"]);
  const [note, setNote] = useState("Sevan river causeway submerged; elderly resident requires oxygen transport.");
  const [sending, setSending] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [queue, setQueue] = useState<SOSPacket[]>([]);

  useEffect(() => {
    getQueuedOfflineSOS().then((stored) => {
      if (stored && stored.length > 0) setQueue(stored);
    });
  }, []);

  const toggleNeed = (needId: string) => {
    if (selectedNeeds.includes(needId)) {
      setSelectedNeeds(selectedNeeds.filter((n) => n !== needId));
    } else {
      setSelectedNeeds([...selectedNeeds, needId]);
    }
  };

  const handleBroadcastSOS = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);

    const lat = navicFix?.lat || 23.0910;
    const lng = navicFix?.lng || 77.0580;

    const packetId = `SOS-LORA-${Math.floor(1000 + Math.random() * 9000)}`;
    const newPacket: SOSPacket = {
      sos_id: packetId,
      device_id: "TACTICAL-NODE-07",
      timestamp: new Date().toISOString(),
      position: {
        lat,
        lng,
        accuracy_m: navicFix?.accuracy_m || 2.0,
        navic_band: navicFix?.navic_band || "L5+S_PASSIVE",
      },
      triage: {
        severity,
        headcount,
        needs: selectedNeeds,
        note,
      },
      mesh: {
        transport: "LORA_865MHZ",
        hop_count: 1,
        max_hops: 4,
        relay_path: ["NODE-FIELD-07"],
        sync_status: "QUEUED_OFFLINE",
      },
    };

    await queueOfflineSOS(newPacket);
    setQueue((prev) => [newPacket, ...prev]);
    onPacketQueued?.(newPacket);

    // Multi-hop simulated RF relay step
    setTimeout(async () => {
      const relayedPacket: SOSPacket = {
        ...newPacket,
        mesh: {
          ...newPacket.mesh,
          hop_count: 2,
          relay_path: ["NODE-FIELD-07", "NODE-RIDGE-02", "GATEWAY-CAMP-01"],
          sync_status: "RELAYED_MESH",
        },
      };
      await updateQueuedOfflineSOS(relayedPacket);
      setQueue((prev) => prev.map((p) => (p.sos_id === newPacket.sos_id ? relayedPacket : p)));
      setSending(false);
    }, 1200);
  };

  const handleSyncToCommand = async () => {
    if (queue.length === 0) return;
    setSyncing(true);

    for (const pkt of queue) {
      if (pkt.mesh.sync_status !== "SYNCED_COMMAND") {
        try {
          const res = await fetch("/api/sos", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(pkt),
          });
          if (res.ok) {
            const synced: SOSPacket = {
              ...pkt,
              mesh: { ...pkt.mesh, sync_status: "SYNCED_COMMAND" },
            };
            await updateQueuedOfflineSOS(synced);
            setQueue((prev) => prev.map((p) => (p.sos_id === pkt.sos_id ? synced : p)));
          }
        } catch (e) {
          console.warn("Backhaul upload failed:", e);
        }
      }
    }
    setSyncing(false);
  };

  const approxBytes = 72 + note.length;

  return (
    <div className={`field-lcd rounded-lg p-3 text-xs font-mono space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <div className="flex items-center space-x-2">
          <Radio className="w-3.5 h-3.5 text-amber-400" />
          <span className="font-bold text-white tracking-wider text-[11px]">
            LORA MESH TRANSCEIVER // 865.2 MHz
          </span>
        </div>
        <div className="text-[10px] text-slate-400">
          IN865 · BW 125kHz · SF9
        </div>
      </div>

      {/* SOS Composer Form */}
      <form onSubmit={handleBroadcastSOS} className="space-y-2.5">
        {/* Severity & Headcount */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">Triage Severity</label>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {(["CRITICAL", "HIGH", "MODERATE", "LOW"] as HazardSeverity[]).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverity(sev)}
                  className={`py-1 rounded text-center border font-bold transition ${
                    severity === sev
                      ? sev === "CRITICAL"
                        ? "bg-rose-950 text-rose-300 border-rose-700"
                        : sev === "HIGH"
                        ? "bg-amber-950 text-amber-300 border-amber-700"
                        : "bg-slate-800 text-slate-200 border-slate-600"
                      : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 uppercase block mb-1">
              Persons (Pax): <strong className="text-white text-xs">{headcount}</strong>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={headcount}
              onChange={(e) => setHeadcount(parseInt(e.target.value))}
              className="w-full accent-amber-500 bg-slate-800 rounded mt-1"
            />
            <div className="flex justify-between text-[9px] text-slate-500 mt-1">
              <span>1</span>
              <span>25</span>
              <span>50+</span>
            </div>
          </div>
        </div>

        {/* Tactical Needs Checklist */}
        <div>
          <label className="text-[10px] text-slate-400 uppercase block mb-1">Required Assets</label>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            {NEED_OPTIONS.map((need) => (
              <button
                key={need.id}
                type="button"
                onClick={() => toggleNeed(need.id)}
                className={`py-1 px-1.5 rounded text-left border transition ${
                  selectedNeeds.includes(need.id)
                    ? "bg-slate-800 text-white border-amber-500/70 font-semibold"
                    : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300"
                }`}
              >
                {need.label}
              </button>
            ))}
          </div>
        </div>

        {/* Triage Note */}
        <div>
          <div className="flex justify-between items-center text-[10px] text-slate-400 mb-1">
            <span className="uppercase">Field Situation Dispatch Note</span>
            <span className="tabular-data text-slate-500">{approxBytes} B / &lt;128 B</span>
          </div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full bg-[#070c18] border border-slate-800 rounded p-1.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-500 font-sans"
            placeholder="State immediate road submergence, injury count, or water depth..."
          />
        </div>

        {/* Transmit Button */}
        <button
          type="submit"
          disabled={sending}
          className="w-full py-2 rounded bg-rose-700 hover:bg-rose-600 text-white font-mono font-bold text-xs flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>{sending ? "BROADCASTING OVER LORA RF..." : "TRANSMIT OFFLINE LORA SOS (<128 B)"}</span>
        </button>
      </form>

      {/* Visual Multi-Hop RF Mesh Relay Chain Progression */}
      <div className="bg-[#070c18] border border-slate-800 rounded p-2.5 space-y-1.5 font-mono">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-300 font-bold flex items-center space-x-1.5">
            <Radio className="w-3 h-3 text-amber-400 animate-pulse" />
            <span className="uppercase">RF MESH MULTI-HOP RELAY (865.2 MHz)</span>
          </span>
          <span className="text-emerald-400 font-bold text-[9px] bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800">
            {sending ? "TRANSMITTING..." : "2 HOPS TO C2 BACKHAUL"}
          </span>
        </div>

        <div className="flex items-center justify-between bg-slate-900/90 border border-slate-800/80 px-2 py-1.5 rounded text-[10px]">
          {/* Hop 0: Field Node */}
          <div className="flex items-center space-x-1.5">
            <div className={`w-2 h-2 rounded-full ${sending ? "bg-amber-400 animate-ping" : "bg-emerald-400 animate-pulse"}`} />
            <div>
              <div className="font-bold text-white text-[10px]">NODE-FIELD-07</div>
              <div className="text-[8px] text-slate-400">Handheld Node</div>
            </div>
          </div>

          <ArrowRight className={`w-3.5 h-3.5 ${sending ? "text-amber-400 animate-pulse" : "text-slate-600"}`} />

          {/* Hop 1: Ridge Repeater */}
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-cyan-400" />
            <div>
              <div className="font-bold text-cyan-300 text-[10px]">NODE-RIDGE-02</div>
              <div className="text-[8px] text-slate-400">514m Ridge</div>
            </div>
          </div>

          <ArrowRight className={`w-3.5 h-3.5 ${sending ? "text-amber-400 animate-pulse" : "text-slate-600"}`} />

          {/* Hop 2: Base Gateway */}
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div>
              <div className="font-bold text-emerald-300 text-[10px]">GATEWAY-CAMP-01</div>
              <div className="text-[8px] text-slate-400">Base C2 Backhaul</div>
            </div>
          </div>
        </div>
      </div>

      {/* Queued Packets & Multi-Hop Relay Monitor */}
      <div className="space-y-1.5 pt-2 border-t border-slate-800">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-slate-400 uppercase font-bold">
            RF BUFFER ({queue.length} PACKETS)
          </span>
          <button
            onClick={handleSyncToCommand}
            disabled={syncing || queue.length === 0}
            className="text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 transition disabled:opacity-40"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            <span>SYNC TO C2</span>
          </button>
        </div>

        <div className="space-y-1 max-h-32 overflow-y-auto">
          {queue.length === 0 ? (
            <p className="text-[10px] text-slate-600 italic py-1 text-center">
              No distress packets buffered in local store.
            </p>
          ) : (
            queue.map((pkt) => (
              <div
                key={pkt.sos_id}
                className="bg-[#070c18] p-1.5 rounded border border-slate-800 text-[10px] space-y-0.5"
              >
                <div className="flex justify-between items-center font-bold">
                  <span className="text-white">{pkt.sos_id}</span>
                  <span
                    className={`px-1 py-0.2 rounded text-[9px] ${
                      pkt.mesh.sync_status === "SYNCED_COMMAND"
                        ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                        : "bg-amber-950 text-amber-300 border border-amber-800"
                    }`}
                  >
                    {pkt.mesh.sync_status}
                  </span>
                </div>
                <div className="text-slate-400 text-[9px] truncate font-sans">
                  {pkt.triage.note}
                </div>
                <div className="flex justify-between text-[9px] text-slate-500">
                  <span>Hops: {pkt.mesh.hop_count}</span>
                  <span>{pkt.mesh.relay_path.join(" → ")}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
