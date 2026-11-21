"use client";

import React, { useState } from "react";
import {
  Play,
  RotateCcw,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Waves,
  WifiOff,
  Send,
  CheckCircle2,
  AlertTriangle,
  Radio,
  SlidersHorizontal,
  Compass,
} from "lucide-react";
import { OperationalMode } from "@/lib/terrapulseClient";

interface JudgeDemoBarProps {
  currentMode?: OperationalMode;
  maxRainfall?: number;
  submergedCount?: number;
  openCorridorsCount?: number;
  activeSosCount?: number;
  payloadKb?: number;
  onStep1RainSpike: () => Promise<void>;
  onStep2SarReroute: () => Promise<void>;
  onStep3CellBlackout: () => Promise<void>;
  onStep4VectorPush: () => Promise<void>;
  onResetBasin: () => Promise<void>;
  className?: string;
}

export default function JudgeDemoBar({
  currentMode = "NORMAL",
  maxRainfall = 4.8,
  submergedCount = 0,
  openCorridorsCount = 1,
  activeSosCount = 2,
  payloadKb = 5.68,
  onStep1RainSpike,
  onStep2SarReroute,
  onStep3CellBlackout,
  onStep4VectorPush,
  onResetBasin,
  className = "",
}: JudgeDemoBarProps) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [collapsed, setCollapsed] = useState(false);
  const [running, setRunning] = useState(false);

  const steps = [
    {
      num: 1,
      title: "MOSDAC Rain Surge",
      subtitle: "INSAT-3DS >15 mm/h Alert",
      desc: "Simulates sudden monsoon cloudburst over Kothri Kalan / Sehore. Rainfall crosses 15.0 mm/h threshold, triggering automated regional flood extraction.",
      action: async () => {
        setRunning(true);
        setActiveStep(1);
        await onStep1RainSpike();
        setRunning(false);
      },
    },
    {
      num: 2,
      title: "SAR Flood + VEDAS Reroute",
      subtitle: "EOS-04 SAR & Cartosat DEM",
      desc: "Cloud-penetrating SAR detects river causeway inundation. Low-lying roads marked SUBMERGED (+0.85m); Cartosat DEM dynamically opens safe dry ridge corridors (>510m AMSL).",
      action: async () => {
        setRunning(true);
        setActiveStep(2);
        await onStep2SarReroute();
        setRunning(false);
      },
    },
    {
      num: 3,
      title: "Telecom Blackout Simulation",
      subtitle: "NavIC L5+S & LoRa 865 MHz",
      desc: "Simulates regional cellular power grid failure. System activates zero-SIM passive NavIC positioning and LoRa 865.2 MHz tactical multi-hop mesh relays.",
      action: async () => {
        setRunning(true);
        setActiveStep(3);
        await onStep3CellBlackout();
        setRunning(false);
      },
    },
    {
      num: 4,
      title: "Field SOS & Vector Broadcast",
      subtitle: "<100 KB Tactical Vector Push",
      desc: "Simulates field distress micro-packet relayed over 2 mesh hops (78 Bytes) and broadcasts compressed GeoJSON evacuation vector to field responders.",
      action: async () => {
        setRunning(true);
        setActiveStep(4);
        await onStep4VectorPush();
        setRunning(false);
      },
    },
  ];

  const handleReset = async () => {
    setRunning(true);
    setActiveStep(0);
    await onResetBasin();
    setRunning(false);
  };

  return (
    <div
      className={`bg-[#0a0f1d]/95 border border-cyan-500/40 rounded-lg shadow-2xl backdrop-blur-md text-xs font-mono select-none z-30 transition-all duration-300 ${
        collapsed ? "py-1 px-3" : "p-3"
      } ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-bold text-white tracking-wider text-[11px] uppercase">
            JUDGE INTERACTIVE SCENARIO RUNNER
          </span>
          <span className="text-[10px] text-slate-400 hidden sm:inline">
            [Click steps 1→4 to evaluate live cascade]
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleReset}
            disabled={running}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] border border-slate-700 transition disabled:opacity-50"
            title="Reset catchment to baseline state"
          >
            <RotateCcw className="w-3 h-3" />
            <span>RESET BASIN</span>
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-slate-400 hover:text-white p-1 rounded"
            title={collapsed ? "Expand Walkthrough Strip" : "Minimize Strip"}
          >
            {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Expanded Step Strip */}
      {!collapsed && (
        <div className="mt-2.5 space-y-2">
          {/* Step Action Buttons */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {steps.map((st) => {
              const isActive = activeStep === st.num;
              return (
                <button
                  key={st.num}
                  onClick={st.action}
                  disabled={running}
                  className={`p-2 rounded text-left border transition relative flex flex-col justify-between ${
                    isActive
                      ? "bg-cyan-950/80 border-cyan-400 text-white shadow-md shadow-cyan-500/20"
                      : "bg-[#070b16] border-slate-800 text-slate-300 hover:bg-slate-800/80 hover:text-white"
                  } disabled:opacity-50`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold text-cyan-400">
                      STEP {st.num}
                    </span>
                    {isActive && (
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                    )}
                  </div>
                  <div className="font-bold text-[11px] leading-tight truncate">
                    {st.title}
                  </div>
                  <div className="text-[9px] text-slate-500 mt-0.5 truncate">
                    {st.subtitle}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Live Impact Explanation */}
          <div className="bg-[#050811] p-2 rounded border border-slate-800/80 text-[11px] text-slate-300 font-sans flex items-start space-x-2">
            <div className="mt-0.5 text-cyan-400 flex-shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <span className="font-mono text-[10px] text-cyan-300 font-bold uppercase block">
                {activeStep === 0
                  ? "BASELINE MONITORING: Catchment nominal (4.8 mm/h rain, 1 open corridor, 5.68 KB vector)."
                  : `STEP ${activeStep} ACTIVE: ${steps[activeStep - 1].title}`}
              </span>
              <p className="text-[11px] text-slate-300 mt-0.5 leading-snug">
                {activeStep === 0
                  ? "Click Step 1 to trigger the extreme MOSDAC rain spike (>15 mm/h) and observe how the ISRO Quad-Core GeoAI cascade recalculates road passability and evacuation corridors in real-time."
                  : steps[activeStep - 1].desc}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
