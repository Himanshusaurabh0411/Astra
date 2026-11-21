"use client";

import React from "react";
import {
  BarChart3,
  Cpu,
  Layers,
  Radio,
  Zap,
  TrendingUp,
  HardDrive,
  Timer,
  CheckCircle2,
  Activity,
} from "lucide-react";
import { TerraPulseStateResponse } from "@/lib/terrapulseClient";
import { Sparkline } from "@/components/primitives/Sparkline";

interface AnalyticsViewProps {
  state: TerraPulseStateResponse | null;
  isAdvancedView?: boolean;
}

export function AnalyticsView({ state, isAdvancedView = false }: AnalyticsViewProps) {
  const kpis = state?.kpis;
  const maxRain = kpis?.max_rainfall_mm_hr || 4.8;
  const isRainBreached = maxRain >= 15.0;
  const payloadKb = kpis?.payload_kb || 5.68;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <BarChart3 className="w-6 h-6 text-purple-400" />
            <span>Cross-Domain Satellite Analytics & Performance</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time correlation across MOSDAC nowcasts, Bhoonidhi SAR inundation, VEDAS DEM vectors, and LoRa mesh latency.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/30 text-purple-400 text-xs font-bold flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5" />
            <span>Quad-Core ISRO Fusion</span>
          </span>
        </div>
      </div>

      {/* Top 4 Performance Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Vector Compression</span>
            <HardDrive className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-white">{payloadKb}</span>
            <span className="text-xs font-semibold text-emerald-400">KB (&lt;100 KB)</span>
          </div>
          <span className="text-[10px] text-slate-400">99.8% smaller than 2.4 GB raw GeoTIFF</span>
        </div>

        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Convective Rain Surge</span>
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-white">{maxRain}</span>
            <span className="text-xs font-semibold text-blue-400">mm/h</span>
          </div>
          <span className="text-[10px] text-slate-400">{isRainBreached ? "Threshold breached (>15 mm/h)" : "Nominal catchment baseline"}</span>
        </div>

        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>SAR Radar Resolution</span>
            <Cpu className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-white">5.4</span>
            <span className="text-xs font-semibold text-purple-400">GHz C-Band</span>
          </div>
          <span className="text-[10px] text-slate-400">Cloud-penetrating all-weather SAR</span>
        </div>

        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 flex flex-col justify-between space-y-2">
          <div className="flex justify-between items-center text-xs text-slate-400">
            <span>Mesh Packet Relay</span>
            <Radio className="w-4 h-4 text-amber-400" />
          </div>
          <div className="flex items-baseline space-x-1.5">
            <span className="text-2xl font-bold text-white">78</span>
            <span className="text-xs font-semibold text-amber-400">Bytes / 2 Hops</span>
          </div>
          <span className="text-[10px] text-slate-400">LoRa 865.2 MHz SF9 off-grid</span>
        </div>
      </div>

      {/* Cross-Domain Correlation Visual Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card 1: Rain Spike to Inundation Timeline */}
        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-white">Rainfall Surge vs Radar Inundation Correlation</h3>
            <span className="text-[10px] font-mono text-slate-400">Last 6 Hours</span>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-slate-400">Rainfall (MOSDAC INSAT-3DS):</span>
              <strong className="text-blue-400">{maxRain} mm/h</strong>
            </div>
            <Sparkline data={[2.1, 3.4, 4.2, 5.8, 12.4, maxRain]} color="#3B82F6" width={340} height={50} />

            <div className="flex justify-between text-xs pt-2">
              <span className="text-slate-400">Inundation Extent (Bhoonidhi SAR):</span>
              <strong className="text-emerald-400">{isRainBreached ? "4.2 km² (+84%)" : "2.8 km² (Nominal)"}</strong>
            </div>
            <Sparkline data={[1.4, 1.8, 2.1, 2.4, 2.8, isRainBreached ? 4.2 : 2.8]} color="#10B981" width={340} height={50} />
          </div>

          <p className="text-[11px] text-slate-400 leading-snug">
            Automated correlation: When convective precipitation crosses 15 mm/hr, the Bhoonidhi EOS-04 pipeline triggers automated water extraction, identifying submerged causeways and computing dry ridge bypasses.
          </p>
        </div>

        {/* Card 2: Evacuation Corridor Readiness & Elevation */}
        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-5 space-y-4 shadow-lg">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-sm text-white">Evacuation Ridge Passability (Cartosat DEM)</h3>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">&gt;510m AMSL Safe</span>
          </div>

          <div className="space-y-3 text-xs">
            <div className="p-2.5 rounded-xl bg-[#090E1A] border border-[#1A2640] flex justify-between items-center">
              <div>
                <div className="font-bold text-white">SH-18 Ridge Bypass</div>
                <div className="text-[10px] text-slate-400">High ground evacuation route</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-emerald-400">514m AMSL</span>
                <span className="block text-[9px] text-emerald-400 font-bold">PASSABLE</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#090E1A] border border-[#1A2640] flex justify-between items-center">
              <div>
                <div className="font-bold text-white">Sevan River Causeway</div>
                <div className="text-[10px] text-slate-400">Low-water bridge crossing</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-slate-400">482m AMSL</span>
                <span className={`block text-[9px] font-bold ${isRainBreached ? "text-red-400" : "text-emerald-400"}`}>
                  {isRainBreached ? "SUBMERGED (+0.85m)" : "PASSABLE"}
                </span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-[#090E1A] border border-[#1A2640] flex justify-between items-center">
              <div>
                <div className="font-bold text-white">VIT Relief Shelter Grounds</div>
                <div className="text-[10px] text-slate-400">Primary designated high-ground camp</div>
              </div>
              <div className="text-right">
                <span className="text-xs font-bold text-emerald-400">512m AMSL</span>
                <span className="block text-[9px] text-emerald-400 font-bold">SAFE HAVEN</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AnalyticsView;
