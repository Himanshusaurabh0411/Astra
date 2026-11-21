"use client";

import React from "react";
import { Droplets, Activity } from "lucide-react";
import { TerraPulseStateResponse } from "@/lib/terrapulseClient";
import SectorViews from "@/components/SectorViews";

interface HydrologyViewProps {
  state: TerraPulseStateResponse | null;
  onDispatchCorridor?: (zone: string) => void;
  isAdvancedView?: boolean;
}

export function HydrologyView({
  state,
  onDispatchCorridor,
  isAdvancedView = false,
}: HydrologyViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <Droplets className="w-6 h-6 text-blue-400" />
            <span>Hydrology, Dams & Critical Infrastructure Audit</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Reservoir FRL telemetry, inflow/discharge cumec rates, spillway surcharge warnings, and critical road submergence audits.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1.5 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-bold flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>Real-time Inflow Gauge</span>
          </span>
        </div>
      </div>

      {/* Main Hydrology Sector Component */}
      <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 shadow-xl">
        <SectorViews
          state={state}
          activeSector="audit"
          onDispatchCorridor={onDispatchCorridor}
        />
      </div>
    </div>
  );
}

export default HydrologyView;
