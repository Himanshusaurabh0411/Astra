"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Radio,
  Send,
  AlertTriangle,
  Users,
  Compass,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  PhoneCall,
  ExternalLink,
} from "lucide-react";
import { TerraPulseStateResponse, SOSPacket } from "@/lib/terrapulseClient";

interface EmergencySOSViewProps {
  state: TerraPulseStateResponse | null;
  onDispatchCorridor: (payload?: any) => Promise<void>;
  onSelectFeature?: (item: any) => void;
  isAdvancedView?: boolean;
}

export function EmergencySOSView({
  state,
  onDispatchCorridor,
  onSelectFeature,
  isAdvancedView = false,
}: EmergencySOSViewProps) {
  const [dispatching, setDispatching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const sosPackets = state?.sos_packets || [];
  const dispatches = state?.dispatches || [];
  const totalHeadcount = sosPackets.reduce((acc, p) => acc + (p.triage?.headcount || 1), 0);
  const criticalCount = sosPackets.filter((p) => p.triage?.severity === "CRITICAL").length;

  const handleBroadcast = async () => {
    setDispatching(true);
    try {
      await onDispatchCorridor();
      setToast("Safe evacuation vector broadcasted to all active mesh rescue boats.");
      setTimeout(() => setToast(null), 3500);
    } finally {
      setDispatching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <Radio className="w-6 h-6 text-red-500 animate-pulse" />
            <span>SOS & Emergency Response Operations</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Off-grid citizen & responder distress telemetry relayed across peer-to-peer LoRa 865 MHz radio mesh with NavIC L5+S fixes.
          </p>
        </div>

        <div className="flex items-center space-x-2.5">
          <Link
            href="/field"
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg shadow-blue-500/25"
          >
            <span>Open Tactical Field Responder</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400">Total Distress Beacons</span>
          <div className="text-2xl font-bold text-white">{sosPackets.length}</div>
          <span className="text-[10px] text-red-400 font-bold">{criticalCount} Critical Priority</span>
        </div>

        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400">Persons Requiring Rescue</span>
          <div className="text-2xl font-bold text-amber-400">{totalHeadcount}</div>
          <span className="text-[10px] text-slate-400">Tracked via NavIC fixes</span>
        </div>

        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400">Mesh Radio Band</span>
          <div className="text-2xl font-bold text-purple-400">865.2 <span className="text-xs font-normal">MHz</span></div>
          <span className="text-[10px] text-slate-400">Zero-cell radio hops</span>
        </div>

        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 space-y-1">
          <span className="text-xs text-slate-400">Active Evac Orders</span>
          <div className="text-2xl font-bold text-emerald-400">{dispatches.length}</div>
          <span className="text-[10px] text-emerald-400 font-bold">Safe Ridge Verified</span>
        </div>
      </div>

      {toast && (
        <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs flex items-center space-x-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Distress Packets Grid */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-sm text-white">Incoming Emergency Distress Packets</h3>
          <button
            onClick={handleBroadcast}
            disabled={dispatching}
            className="px-3 py-1.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg shadow-red-600/30 disabled:opacity-50"
          >
            <Send className="w-3.5 h-3.5" />
            <span>{dispatching ? "Broadcasting..." : "Broadcast Corridor Vector to All Boats"}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sosPackets.map((pkt) => {
            const isCrit = pkt.triage.severity === "CRITICAL";

            return (
              <div
                key={pkt.sos_id}
                className={`bg-[#0D1526] border rounded-2xl p-4 space-y-3 shadow-lg ${
                  isCrit ? "border-red-500/40 bg-gradient-to-b from-[#16121E] to-[#0D1526]" : "border-[#1A2640]"
                }`}
              >
                <div className="flex justify-between items-center">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold font-mono text-sm text-white">{pkt.sos_id}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isCrit ? "bg-red-500/20 text-red-400" : "bg-amber-500/20 text-amber-400"
                      }`}
                    >
                      {pkt.triage.severity} ({pkt.triage.headcount} pax)
                    </span>
                  </div>

                  <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded-full border border-emerald-800">
                    {pkt.mesh.sync_status}
                  </span>
                </div>

                <p className="text-xs text-slate-300 leading-snug">
                  &quot;{pkt.triage.note}&quot;
                </p>

                <div className="p-2.5 rounded-xl bg-[#090E1A] border border-[#162136] text-[10px] font-mono text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Position:</span>
                    <span className="text-white font-bold">{pkt.position.lat.toFixed(4)}°N, {pkt.position.lng.toFixed(4)}°E (±{pkt.position.accuracy_m}m)</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Needs:</span>
                    <span className="text-amber-400 font-bold">{pkt.triage.needs.join(", ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Relay Path:</span>
                    <span className="text-purple-400 font-bold">{pkt.mesh.relay_path.join(" → ")} ({pkt.mesh.hop_count} hops)</span>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-1 border-t border-[#162136]">
                  <button
                    onClick={() => onSelectFeature?.(pkt)}
                    className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
                  >
                    <span>Inspect on Map</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>

                  <span className="text-[10px] text-slate-500 font-mono">
                    Device: {pkt.device_id}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default EmergencySOSView;
