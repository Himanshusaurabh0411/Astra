"use client";

import React from "react";
import { Sprout, Activity, ArrowRight } from "lucide-react";
import { TerraPulseStateResponse } from "@/lib/terrapulseClient";
import SectorViews from "@/components/SectorViews";

interface AgricultureViewProps {
  state: TerraPulseStateResponse | null;
  onTriggerClaim?: (block: string) => void;
  onDispatchCorridor?: (zone: string) => void;
  isAdvancedView?: boolean;
}

export function AgricultureView({
  state,
  onTriggerClaim,
  onDispatchCorridor,
  isAdvancedView = false,
}: AgricultureViewProps) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <Sprout className="w-6 h-6 text-emerald-400" />
            <span>Agriculture & Crop Stress Intelligence (VEDAS + MOSDAC)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Satellite photosynthetic canopy (NDVI), root-zone soil moisture saturation, and PMFBY parametric insurance claim triage.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>Kharif Crop Season 2026</span>
          </span>
        </div>
      </div>

      {/* Main Agriculture Sector Component */}
      <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 shadow-xl">
        <SectorViews
          state={state}
          activeSector="agri"
          onTriggerClaim={onTriggerClaim}
          onDispatchCorridor={onDispatchCorridor}
        />
      </div>
    </div>
  );
}

export default AgricultureView;
