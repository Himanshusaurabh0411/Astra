"use client";

import React, { useState } from "react";
import {
  Settings,
  Wifi,
  WifiOff,
  Radio,
  Zap,
  RotateCcw,
  CheckCircle2,
  Cpu,
  Layers,
  HelpCircle,
} from "lucide-react";
import {
  TerraPulseStateResponse,
  OperationalMode,
  switchOperationalMode,
  triggerRainfallSpike,
  resetScenario,
} from "@/lib/terrapulseClient";

interface SettingsViewProps {
  state: TerraPulseStateResponse | null;
  onStateUpdate: (newState: TerraPulseStateResponse) => void;
  isAdvancedView: boolean;
  onToggleAdvancedView: () => void;
  onShowToast: (msg: string) => void;
}

export function SettingsView({
  state,
  onStateUpdate,
  isAdvancedView,
  onToggleAdvancedView,
  onShowToast,
}: SettingsViewProps) {
  const [loading, setLoading] = useState(false);

  const handleMode = async (mode: OperationalMode) => {
    setLoading(true);
    try {
      const updated = await switchOperationalMode(mode);
      onStateUpdate(updated);
      onShowToast(`Switched operational mode to ${mode}`);
    } catch (err: any) {
      onShowToast("Mode update error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRainSpike = async () => {
    setLoading(true);
    try {
      const updated = await triggerRainfallSpike(4.5);
      onStateUpdate(updated);
      onShowToast("MOSDAC rain spike recorded (>15 mm/h). Bhoonidhi SAR flood extraction triggered.");
    } catch (err: any) {
      onShowToast("Rain spike failed: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      const updated = await resetScenario();
      onStateUpdate(updated);
      onShowToast("Catchment parameters restored to nominal baseline.");
    } catch (err: any) {
      onShowToast("Reset error: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
          <Settings className="w-6 h-6 text-slate-300" />
          <span>Platform Settings & Disaster Simulations</span>
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Configure telemetry display modes, simulate telecom blackouts, trigger convective storm cascades, and test recovery routines.
        </p>
      </div>

      {/* Setting 1: Standard View vs Advanced Satellite Telemetry */}
      <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-5 space-y-3 shadow-lg">
        <div className="flex justify-between items-center">
          <div>
            <h3 className="font-bold text-sm text-white">Telemetry & Display Level</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Standard View simplifies metrics for emergency decision-makers; Advanced View displays raw satellite frequencies, radar backscatter, and byte budgets.
            </p>
          </div>

          <button
            onClick={onToggleAdvancedView}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition ${
              isAdvancedView
                ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-500/25"
                : "bg-[#111A2C] text-slate-300 border-[#233550] hover:text-white"
            }`}
          >
            {isAdvancedView ? "Advanced Telemetry Active" : "Standard View Active"}
          </button>
        </div>
      </div>

      {/* Setting 2: Operational Mode Switcher */}
      <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-5 space-y-3 shadow-lg">
        <div>
          <h3 className="font-bold text-sm text-white">Operational Network Mode</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Simulate complete cellular blackout to verify off-grid LoRa 865 MHz peer-to-peer radio mesh and passive NavIC L5+S positioning.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            onClick={() => handleMode("NORMAL")}
            disabled={loading}
            className={`p-3 rounded-xl border text-left transition ${
              state?.mode === "NORMAL"
                ? "bg-emerald-950/80 border-emerald-600 text-emerald-300 shadow-md"
                : "bg-[#10192C] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2 font-bold text-xs mb-1">
              <Wifi className="w-4 h-4 text-emerald-400" />
              <span>Cellular Online</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Standard 4G/5G backhaul connectivity. Direct WebSocket sync.
            </p>
          </button>

          <button
            onClick={() => handleMode("CELL_BLACKOUT_MESH_ACTIVE")}
            disabled={loading}
            className={`p-3 rounded-xl border text-left transition ${
              state?.mode === "CELL_BLACKOUT_MESH_ACTIVE"
                ? "bg-rose-950/80 border-rose-600 text-rose-300 shadow-md animate-pulse"
                : "bg-[#10192C] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2 font-bold text-xs mb-1">
              <WifiOff className="w-4 h-4 text-rose-400" />
              <span>Cell Blackout (LoRa Mesh)</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Cell towers disabled. Activates peer-to-peer LoRa 865 MHz radio relays.
            </p>
          </button>

          <button
            onClick={() => handleMode("BACKHAUL_SYNC")}
            disabled={loading}
            className={`p-3 rounded-xl border text-left transition ${
              state?.mode === "BACKHAUL_SYNC"
                ? "bg-amber-950/80 border-amber-600 text-amber-300 shadow-md"
                : "bg-[#10192C] border-[#1E293B] text-slate-400 hover:text-white"
            }`}
          >
            <div className="flex items-center space-x-2 font-bold text-xs mb-1">
              <Radio className="w-4 h-4 text-amber-400" />
              <span>Burst Sync Mode</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-snug">
              Intermittent satellite uplink batch sync for buffered field packets.
            </p>
          </button>
        </div>
      </div>

      {/* Setting 3: Judge Disaster Scenario Simulations */}
      <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-5 space-y-4 shadow-lg">
        <div>
          <h3 className="font-bold text-sm text-white">Disaster Scenario Triggers</h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Inject extreme weather conditions to test automated quad-core ISRO GeoAI recalculation.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={handleRainSpike}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-blue-600/20 hover:bg-blue-600/40 border border-blue-500/40 text-blue-300 text-xs font-semibold flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Zap className="w-4 h-4 text-blue-400" />
            <span>Inject MOSDAC Rain Spike (&gt;15 mm/h)</span>
          </button>

          <button
            onClick={handleReset}
            disabled={loading}
            className="px-4 py-2 rounded-xl bg-[#162136] hover:bg-[#233550] border border-[#2B3E60] text-slate-200 text-xs font-semibold flex items-center space-x-2 transition disabled:opacity-50"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset Basin to Nominal Baseline</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
