"use client";

import React, { useState, useEffect } from "react";
import {
  Radio,
  Send,
  RefreshCw,
  ArrowRight,
  Loader2,
  AlertCircle,
} from "lucide-react";
import {
  SOSPacket,
  HazardSeverity,
  submitSOSPacket,
} from "@/lib/terrapulseClient";
import {
  queueOfflineSOS,
  getQueuedOfflineSOS,
  updateQueuedOfflineSOS,
  NavicFixData,
} from "@/lib/offlineStore";
import { SurveyCard } from "./primitives/SurveyCard";
import { StatusChip } from "./primitives/StatusChip";
import { BudgetMeter } from "./primitives/BudgetMeter";

export interface LoraMeshPanelProps {
  navicFix: NavicFixData | null;
  onPacketQueued?: (packet: SOSPacket) => void;
  className?: string;
}

const NEED_OPTIONS = [
  { id: "EVACUATION", label: "Evacuation Rescue" },
  { id: "MEDICAL", label: "Medical Aid / Trauma" },
  { id: "BOAT_RESCUE", label: "Rescue Boat Needed" },
  { id: "WATER", label: "Drinking Water" },
  { id: "FOOD", label: "Food Packets" },
];

export function LoraMeshPanel({
  navicFix,
  onPacketQueued,
  className = "",
}: LoraMeshPanelProps) {
  const [severity, setSeverity] = useState<HazardSeverity>("CRITICAL");
  const [headcount, setHeadcount] = useState(4);
  const [selectedNeeds, setSelectedNeeds] = useState<string[]>(["EVACUATION", "MEDICAL"]);
  const [note, setNote] = useState(
    "Sevan river causeway submerged; elderly resident requires oxygen transport."
  );
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
      onPacketQueued?.(relayedPacket);
      setSending(false);
    }, 1200);
  };

  const handleSyncToCommand = async () => {
    if (queue.length === 0) return;
    setSyncing(true);

    for (const pkt of queue) {
      if (pkt.mesh.sync_status !== "SYNCED_COMMAND") {
        try {
          await submitSOSPacket(pkt);
          const synced: SOSPacket = {
            ...pkt,
            mesh: { ...pkt.mesh, sync_status: "SYNCED_COMMAND" },
          };
          await updateQueuedOfflineSOS(synced);
          setQueue((prev) => prev.map((p) => (p.sos_id === pkt.sos_id ? synced : p)));
        } catch (e) {
          console.warn("Backhaul upload failed:", e);
        }
      }
    }
    setSyncing(false);
  };

  const approxBytes = 72 + note.length;

  return (
    <SurveyCard ticks={true} className={`p-3 text-xs font-mono space-y-3 ${className}`}>
      {/* Header with Step 2 Badge */}
      <div className="flex items-center justify-between border-b border-ink-700/80 pb-1.5">
        <div className="flex items-center space-x-2">
          <span className="text-[9px] bg-rose-500/20 text-rose-400 font-extrabold px-1.5 py-0.5 rounded border border-rose-500/40 uppercase tracking-survey">
            STEP 2
          </span>
          <div className="flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span className="font-bold text-bone-50 tracking-survey text-[11px] uppercase">
              SEND HELP REQUEST (LORA SOS)
            </span>
          </div>
        </div>
        <div className="text-[10px] text-bone-500 font-bold">
          865 MHz · SF9
        </div>
      </div>

      <p className="text-[10px] text-bone-400 font-sans leading-tight">
        Off-grid peer-to-peer radio broadcast: micro-packet hops across rescue nodes directly to base camp.
      </p>

      {/* SOS Composer Form */}
      <form onSubmit={handleBroadcastSOS} className="space-y-2.5">
        {/* Severity & Headcount */}
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-bone-500 uppercase tracking-survey font-semibold block mb-1">
              Urgency Level
            </label>
            <div className="grid grid-cols-2 gap-1 text-[10px]">
              {(["CRITICAL", "HIGH", "MODERATE", "LOW"] as HazardSeverity[]).map((sev) => (
                <button
                  key={sev}
                  type="button"
                  onClick={() => setSeverity(sev)}
                  className={`py-1 rounded text-center border font-bold transition focus-visible:ring-1 focus-visible:ring-saffron-500 ${
                    severity === sev
                      ? sev === "CRITICAL"
                        ? "bg-rose-950 text-rose-300 border-rose-600 shadow-sm"
                        : sev === "HIGH"
                        ? "bg-amber-950 text-amber-300 border-amber-600 shadow-sm"
                        : "bg-ink-800 text-bone-50 border-ink-600"
                      : "bg-ink-950 border-ink-800 text-bone-500 hover:text-bone-300"
                  }`}
                >
                  {sev}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-[10px] text-bone-500 uppercase tracking-survey font-semibold block mb-1">
              People Trapped: <strong className="text-bone-50 tabular-nums">{headcount}</strong>
            </label>
            <input
              type="range"
              min="1"
              max="50"
              value={headcount}
              onChange={(e) => setHeadcount(parseInt(e.target.value))}
              className="w-full accent-saffron-500 bg-ink-950 rounded mt-1 cursor-pointer"
            />
            <div className="flex justify-between text-[9px] text-bone-500 mt-1 tabular-nums">
              <span>1</span>
              <span>25</span>
              <span>50+</span>
            </div>
          </div>
        </div>

        {/* Tactical Needs Checklist */}
        <div>
          <label className="text-[10px] text-bone-500 uppercase tracking-survey font-semibold block mb-1">
            Immediate Needs
          </label>
          <div className="grid grid-cols-2 gap-1 text-[10px]">
            {NEED_OPTIONS.map((need) => (
              <button
                key={need.id}
                type="button"
                onClick={() => toggleNeed(need.id)}
                className={`py-1 px-1.5 rounded text-left border transition focus-visible:ring-1 focus-visible:ring-saffron-500 ${
                  selectedNeeds.includes(need.id)
                    ? "bg-ink-800 text-bone-50 border-saffron-500/70 font-semibold shadow-sm"
                    : "bg-ink-950 border-ink-800 text-bone-500 hover:text-bone-300"
                }`}
              >
                {need.label}
              </button>
            ))}
          </div>
        </div>

        {/* Triage Note & Byte Budget */}
        <div>
          <BudgetMeter
            current={approxBytes}
            max={128}
            threshold={120}
            unit="Bytes"
            label="LoRa Packet Budget (<128 B)"
            className="mb-1"
          />
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full bg-ink-950 border border-ink-800 rounded p-1.5 text-[11px] text-bone-100 focus:outline-none focus:border-saffron-500 font-sans"
            placeholder="State road submergence, injury count, or water depth..."
          />
        </div>

        {/* Transmit Button */}
        <button
          type="submit"
          disabled={sending}
          className="w-full py-2 rounded bg-severity-critical hover:bg-rose-600 text-white font-mono font-bold text-xs flex items-center justify-center space-x-1.5 shadow transition focus-visible:ring-2 focus-visible:ring-rose-500 disabled:opacity-50"
        >
          {sending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Send className="w-3.5 h-3.5" />
          )}
          <span>{sending ? "Broadcasting Over LoRa RF Mesh..." : "Send Help Request (LoRa SOS <128 B)"}</span>
        </button>
      </form>

      {/* Visual Multi-Hop RF Mesh Relay Chain Progression */}
      <div className="bg-ink-950/90 border border-ink-800 p-2 rounded-md space-y-1.5 font-mono survey-ticks">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-bone-300 font-bold flex items-center space-x-1.5">
            <Radio className="w-3 h-3 text-saffron-500 animate-pulse" />
            <span className="uppercase tracking-survey">Multi-Hop LoRa Mesh Relay</span>
          </span>
          <StatusChip
            variant={sending ? "warning" : "normal"}
            size="sm"
            label={sending ? "TRANSMITTING..." : "2 HOPS TO C2"}
          />
        </div>

        <div className="flex items-center justify-between bg-ink-900 border border-ink-700/80 px-2 py-1.5 rounded text-[10px]">
          {/* Hop 0: Field Node */}
          <div className="flex items-center space-x-1.5">
            <div
              className={`w-2 h-2 rounded-full ${
                sending ? "bg-saffron-500 animate-ping" : "bg-emerald-400 animate-pulse"
              }`}
            />
            <div>
              <div className="font-bold text-bone-50 text-[10px]">NODE-FIELD-07</div>
              <div className="text-[8px] text-bone-500">Your Handheld</div>
            </div>
          </div>

          <ArrowRight className={`w-3.5 h-3.5 ${sending ? "text-saffron-500 animate-pulse" : "text-ink-600"}`} />

          {/* Hop 1: Ridge Repeater */}
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-mosdac" />
            <div>
              <div className="font-bold text-mosdac text-[10px]">NODE-RIDGE-02</div>
              <div className="text-[8px] text-bone-500">514m High Ridge</div>
            </div>
          </div>

          <ArrowRight className={`w-3.5 h-3.5 ${sending ? "text-saffron-500 animate-pulse" : "text-ink-600"}`} />

          {/* Hop 2: Base Gateway */}
          <div className="flex items-center space-x-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div>
              <div className="font-bold text-emerald-300 text-[10px]">GATEWAY-CAMP-01</div>
              <div className="text-[8px] text-bone-500">Command Base</div>
            </div>
          </div>
        </div>
      </div>

      {/* Queued Packets with Plain-English Status Labels */}
      <div className="space-y-1.5 pt-1 border-t border-ink-800">
        <div className="flex justify-between items-center text-[10px]">
          <span className="text-bone-500 uppercase tracking-survey font-bold">
            Outbox Buffer ({queue.length})
          </span>
          <button
            onClick={handleSyncToCommand}
            disabled={syncing || queue.length === 0}
            className="text-saffron-400 hover:text-saffron-300 flex items-center space-x-1 transition disabled:opacity-40 focus-visible:ring-1 focus-visible:ring-saffron-500 rounded"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            <span>SYNC TO BASE</span>
          </button>
        </div>

        <div className="space-y-1 max-h-28 overflow-y-auto">
          {queue.length === 0 ? (
            <p className="text-[10px] text-bone-500 italic py-1 text-center font-sans">
              No emergency packets in local outbox buffer.
            </p>
          ) : (
            queue.map((pkt) => {
              // Exact plain status labels: Saved Offline, Relayed via Mesh, Synced
              const statusLabel =
                pkt.mesh.sync_status === "SYNCED_COMMAND"
                  ? "Synced"
                  : pkt.mesh.sync_status === "RELAYED_MESH"
                  ? "Relayed via Mesh"
                  : "Saved Offline";

              const statusVariant =
                pkt.mesh.sync_status === "SYNCED_COMMAND"
                  ? "normal"
                  : pkt.mesh.sync_status === "RELAYED_MESH"
                  ? "mesh"
                  : "warning";

              return (
                <div
                  key={pkt.sos_id}
                  className="bg-ink-950 p-1.5 rounded border border-ink-800 text-[10px] space-y-0.5"
                >
                  <div className="flex justify-between items-center font-bold">
                    <span className="text-bone-50">{pkt.sos_id}</span>
                    <StatusChip variant={statusVariant} size="sm" label={statusLabel} />
                  </div>
                  <div className="text-bone-300 text-[10px] truncate font-sans">
                    &quot;{pkt.triage.note}&quot;
                  </div>
                  <div className="flex justify-between text-[9px] text-bone-500 tabular-nums">
                    <span>{pkt.triage.severity} • {pkt.triage.headcount} pax</span>
                    <span>{pkt.mesh.relay_path.join(" → ")}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </SurveyCard>
  );
}

export default LoraMeshPanel;
