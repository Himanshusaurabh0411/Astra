"use client";

import React, { useState } from "react";
import {
  RotateCcw,
  ChevronDown,
  ChevronUp,
  CloudRain,
  WifiOff,
  Send,
  SlidersHorizontal,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { OperationalMode } from "@/lib/terrapulseClient";
import { SurveyCard } from "./primitives/SurveyCard";
import { StatusChip } from "./primitives/StatusChip";
import { StatusDot } from "./primitives/StatusDot";

export interface JudgeDemoBarProps {
  currentMode?: OperationalMode;
  maxRainfall?: number;
  submergedCount?: number;
  openCorridorsCount?: number;
  activeSosCount?: number;
  payloadKb?: number;
  onStep1RainSpike: () => Promise<void>;
  onStep2SarReroute?: () => Promise<void>;
  onStep3CellBlackout: () => Promise<void>;
  onStep4VectorPush: () => Promise<void>;
  onResetBasin: () => Promise<void>;
  className?: string;
  onWhatChanged?: (change: {
    step: number;
    title: string;
    cause: string;
    effect: string;
    badge: string;
    badgeVariant: "critical" | "warning" | "normal" | "mesh";
  }) => void;
}

export function JudgeDemoBar({
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
  onWhatChanged,
}: JudgeDemoBarProps) {
  const [activeStep, setActiveStep] = useState<number>(0);
  const [collapsed, setCollapsed] = useState(false);
  const [running, setRunning] = useState(false);

  const steps = [
    {
      num: 1,
      title: "1. Trigger Rain >15 mm/hr",
      subtitle: "MOSDAC Weather Alert + SAR Flood Map",
      portal: "MOSDAC + Bhoonidhi",
      icon: <CloudRain className="w-3.5 h-3.5 text-mosdac" />,
      desc: "Simulates sudden convective cloudburst over Kothri Kalan (>15 mm/hr). Bhoonidhi SAR radar maps flood expansion, marking low-lying Sevan causeway submerged (+0.85m).",
      cause: "INSAT-3DS detects cloudburst exceeding 15.0 mm/hr threshold over Kothri Kalan.",
      effect: "Bhoonidhi SAR radar detects floodwaters rising. Sevan causeway marked submerged; safe dry ridge bypass (>510m AMSL) activated.",
      badge: "RAIN >15 mm/h",
      badgeVariant: "critical" as const,
      action: async () => {
        setRunning(true);
        setActiveStep(1);
        try {
          await onStep1RainSpike();
          if (onStep2SarReroute) {
            await onStep2SarReroute();
          }
          onWhatChanged?.({
            step: 1,
            title: "MOSDAC Rain Alert (>15 mm/hr) & Radar Flood Detection",
            cause: "INSAT-3DS detects convective rainfall surge (>15 mm/hr) over Kothri Kalan.",
            effect: "Bhoonidhi SAR radar detects floodwaters rising. Low-lying Sevan causeway marked submerged (+0.85m); safe dry ridge bypass (>510m AMSL) activated.",
            badge: "RAIN >15 mm/h",
            badgeVariant: "critical",
          });
        } finally {
          setRunning(false);
        }
      },
    },
    {
      num: 2,
      title: "2. Simulate Cell Blackout",
      subtitle: "Switch to Offline LoRa Mesh & NavIC",
      portal: "NavIC + LoRa Mesh",
      icon: <WifiOff className="w-3.5 h-3.5 text-severity-warning" />,
      desc: "Cuts cellular towers. System automatically switches to passive NavIC (L5+S) satellite positioning and off-grid LoRa (865 MHz) radio mesh relays.",
      cause: "Cellular infrastructure power lost across flooded river basin.",
      effect: "Zero-connectivity fallback engaged: passive NavIC (L5+S) positioning active and peer-to-peer LoRa 865 MHz radio mesh transmits distress packets.",
      badge: "CELL BLACKOUT",
      badgeVariant: "warning" as const,
      action: async () => {
        setRunning(true);
        setActiveStep(2);
        try {
          await onStep3CellBlackout();
          onWhatChanged?.({
            step: 2,
            title: "Cellular Blackout Active — LoRa Mesh & NavIC Engaged",
            cause: "Cellular infrastructure failure simulated in Kothri Kalan / Sehore basin.",
            effect: "Zero-SIM fallback: passive NavIC (L5+S) positioning locks coordinates; peer-to-peer LoRa 865 MHz radio relays active.",
            badge: "CELL BLACKOUT",
            badgeVariant: "warning",
          });
        } finally {
          setRunning(false);
        }
      },
    },
    {
      num: 3,
      title: "3. Send Field SOS & Safe Route",
      subtitle: "Relay Distress & Push <100 KB Vector",
      portal: "VEDAS + Tactical Mesh",
      icon: <Send className="w-3.5 h-3.5 text-mesh" />,
      desc: "Simulates field responder distress packet relayed over 2 LoRa hops (78 Bytes) and broadcasts compressed VEDAS safe evacuation corridor vector to rescue boats.",
      cause: "Field responder at Sevan River submits emergency SOS over 865 MHz LoRa mesh.",
      effect: "Central Command pushes VEDAS safe dry ridge route (<100 KB GeoJSON) to field responders and rescue teams.",
      badge: "VECTOR BROADCAST",
      badgeVariant: "mesh" as const,
      action: async () => {
        setRunning(true);
        setActiveStep(3);
        try {
          await onStep4VectorPush();
          onWhatChanged?.({
            step: 3,
            title: "Distress SOS Relayed & Safe Evacuation Corridor Broadcasted",
            cause: "Field responder distress packet relayed across 2 mesh hops (78 Bytes).",
            effect: "VEDAS dry ridge evacuation corridor (<100 KB compact vector) broadcasted to field teams and shelters.",
            badge: "VECTOR BROADCAST",
            badgeVariant: "mesh",
          });
        } finally {
          setRunning(false);
        }
      },
    },
  ];

  const handleReset = async () => {
    setRunning(true);
    setActiveStep(0);
    try {
      await onResetBasin();
      onWhatChanged?.({
        step: 0,
        title: "Catchment Restored to Baseline",
        cause: "Parameters restored to normal baseline.",
        effect: "Rainfall nominal (4.8 mm/h), Sevan causeway passable, cellular network online.",
        badge: "NORMAL",
        badgeVariant: "normal",
      });
    } finally {
      setRunning(false);
    }
  };

  return (
    <SurveyCard
      topo={true}
      ticks={true}
      className={`backdrop-blur-md font-mono select-none transition-all duration-300 ${
        collapsed ? "py-1.5 px-3" : "p-3"
      } ${className}`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <StatusDot status={running ? "warning" : activeStep > 0 ? "mesh" : "normal"} pulse={running} />
          <span className="font-bold text-bone-50 tracking-survey text-[11px] uppercase">
            JUDGE 3-STEP DEMO RAIL
          </span>
          <span className="text-[10px] text-bone-500 hidden sm:inline">
            [Numbered Cause-and-Effect Flow]
          </span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleReset}
            disabled={running}
            className="flex items-center space-x-1 px-2 py-0.5 rounded bg-ink-800/90 hover:bg-ink-700 text-bone-300 hover:text-bone-50 text-[10px] border border-ink-700 transition focus-visible:ring-1 focus-visible:ring-saffron-500 disabled:opacity-50"
            title="Reset catchment to baseline state"
          >
            {running ? (
              <Loader2 className="w-3 h-3 animate-spin text-saffron-500" />
            ) : (
              <RotateCcw className="w-3 h-3" />
            )}
            <span>RESET</span>
          </button>

          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-bone-500 hover:text-bone-50 p-1 rounded transition focus-visible:ring-1 focus-visible:ring-saffron-500"
            title={collapsed ? "Expand Walkthrough Rail" : "Minimize Rail"}
            aria-label={collapsed ? "Expand Rail" : "Minimize Rail"}
          >
            {collapsed ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronUp className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded Step Strip */}
      {!collapsed && (
        <div className="mt-2.5 space-y-2">
          {/* 3 Numbered Guided Actions */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
            {steps.map((st) => {
              const isActive = activeStep === st.num;
              return (
                <button
                  key={st.num}
                  onClick={st.action}
                  disabled={running}
                  className={`p-2 rounded text-left border transition relative flex flex-col justify-between focus-visible:ring-2 focus-visible:ring-saffron-500 ${
                    isActive
                      ? "bg-saffron-500/15 border-saffron-500 text-bone-50 shadow-md shadow-saffron-500/10"
                      : "bg-ink-950/80 border-ink-700/80 text-bone-300 hover:bg-ink-800 hover:text-bone-50"
                  } disabled:opacity-50`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span
                      className={`text-[9px] font-bold uppercase tracking-survey ${
                        isActive ? "text-saffron-400 font-extrabold" : "text-bone-500"
                      }`}
                    >
                      STEP {st.num}
                    </span>
                    <span className="flex items-center space-x-1">
                      {isActive && (
                        <span className="w-1.5 h-1.5 rounded-full bg-saffron-500 animate-ping" />
                      )}
                      {st.icon}
                    </span>
                  </div>

                  <div className="font-bold text-[11px] leading-tight truncate text-bone-50">
                    {st.title}
                  </div>
                  <div className="text-[9px] text-bone-500 mt-0.5 truncate">
                    {st.subtitle}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Active Step Plain-Language Explanation */}
          <div className="bg-ink-950/90 p-2 rounded border border-ink-700/60 text-[11px] text-bone-300 font-sans flex items-start space-x-2">
            <div className="mt-0.5 text-saffron-500 flex-shrink-0">
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </div>
            <div className="flex-1">
              <span className="font-mono text-[10px] text-saffron-400 font-bold uppercase tracking-survey block">
                {activeStep === 0
                  ? "BASELINE MONITORING: Catchment nominal (4.8 mm/h rain, all roads open, cell online)."
                  : `STEP ${activeStep} ACTIVE: ${steps[activeStep - 1].title}`}
              </span>
              <p className="text-[11px] text-bone-300 mt-0.5 leading-snug">
                {activeStep === 0
                  ? "Click Step 1 to trigger the extreme rain surge (>15 mm/hr) and observe how the ISRO Quad-Core GeoAI cascade recalculates road passability and evacuation corridors in real-time."
                  : steps[activeStep - 1].desc}
              </p>
            </div>
          </div>
        </div>
      )}
    </SurveyCard>
  );
}

export default JudgeDemoBar;
