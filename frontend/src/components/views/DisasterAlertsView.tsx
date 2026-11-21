"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  CloudRain,
  Waves,
  Route,
  ShieldAlert,
  Search,
  Filter,
  Send,
  MapPin,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import { TerraPulseStateResponse } from "@/lib/terrapulseClient";

interface DisasterAlertsViewProps {
  state: TerraPulseStateResponse | null;
  onDispatchCorridor: (payload?: any) => Promise<void>;
  onSelectFeature?: (item: any) => void;
  isAdvancedView?: boolean;
}

export function DisasterAlertsView({
  state,
  onDispatchCorridor,
  onSelectFeature,
  isAdvancedView = false,
}: DisasterAlertsViewProps) {
  const [filterType, setFilterType] = useState<"all" | "flood" | "rain" | "road">("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const features = state?.features?.features || [];
  const kpis = state?.kpis;
  const isRainBreached = (kpis?.max_rainfall_mm_hr || 0) >= 15.0;

  // Filter alert features
  const alertItems = features.filter((f) => {
    const isCritical = f.properties.severity === "CRITICAL" || f.properties.severity === "HIGH";
    const isSubmerged = f.properties.road_status === "SUBMERGED";
    const isRain = f.properties.layer === "mosdac_rain" && (f.properties.rainfall_mm_hr || 0) > 10;
    const isFlood = f.properties.layer === "bhoonidhi_flood";
    return isCritical || isSubmerged || isRain || isFlood;
  });

  const filtered = alertItems.filter((item) => {
    if (filterType === "flood" && item.properties.layer !== "bhoonidhi_flood") return false;
    if (filterType === "rain" && item.properties.layer !== "mosdac_rain") return false;
    if (filterType === "road" && item.properties.layer !== "vedas_roads") return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      const matchTitle = item.properties.title?.toLowerCase().includes(q);
      const matchAction = item.properties.recommended_action?.toLowerCase().includes(q);
      return matchTitle || matchAction;
    }
    return true;
  });

  const handleDispatch = async (item: any) => {
    setDispatchingId(item.id);
    try {
      await onDispatchCorridor(item);
    } finally {
      setDispatchingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and KPI strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <ShieldAlert className="w-6 h-6 text-red-500" />
            <span>Disaster Alerts & Hazard Triage</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time multi-satellite disaster alerts across the Kothri Kalan, Sehore, and Bhopal basin.
          </p>
        </div>

        {/* Counter Pills */}
        <div className="flex items-center space-x-2">
          <span className="px-3 py-1.5 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span>{isRainBreached ? "4 Active Critical" : "2 Active Critical"}</span>
          </span>
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold">
            1 Flood Watch
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-3 flex flex-col sm:flex-row justify-between items-center gap-3">
        <div className="flex items-center space-x-1 w-full sm:w-auto">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === "all" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            All Alerts ({alertItems.length})
          </button>
          <button
            onClick={() => setFilterType("flood")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === "flood" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Bhoonidhi Floods
          </button>
          <button
            onClick={() => setFilterType("rain")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === "rain" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            MOSDAC Rain
          </button>
          <button
            onClick={() => setFilterType("road")}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
              filterType === "road" ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            Road Hazards
          </button>
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search alerts or locations..."
            className="w-full bg-[#10192C] border border-[#1E293B] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      {/* Alert Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((item) => {
          const isCritical =
            item.properties.severity === "CRITICAL" || item.properties.road_status === "SUBMERGED";
          const isRain = item.properties.layer === "mosdac_rain";
          const isFlood = item.properties.layer === "bhoonidhi_flood";
          const isRoad = item.properties.layer === "vedas_roads";

          return (
            <div
              key={item.id}
              className={`bg-[#0D1526] border rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg transition hover:border-slate-600 ${
                isCritical ? "border-red-500/40 bg-gradient-to-b from-[#14121F] to-[#0D1526]" : "border-[#1A2640]"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                        isCritical
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      }`}
                    >
                      {item.properties.severity || (isCritical ? "CRITICAL" : "WARNING")}
                    </span>

                    <span className="text-[10px] font-mono text-slate-400">
                      {isFlood
                        ? "Bhoonidhi SAR Radar"
                        : isRain
                        ? "MOSDAC Convective Sat"
                        : isRoad
                        ? "VEDAS Cartosat DEM"
                        : "Bhuvan Cadastre"}
                    </span>
                  </div>

                  {item.properties.water_depth_m && item.properties.water_depth_m > 0 && (
                    <span className="text-xs font-mono font-bold text-red-400 tabular-nums">
                      +{item.properties.water_depth_m}m Water
                    </span>
                  )}
                </div>

                <h3 className="font-bold text-sm text-white">{item.properties.title}</h3>

                <p className="text-xs text-slate-300 leading-snug">
                  {item.properties.recommended_action}
                </p>

                {/* Satellite telemetry specifications */}
                {isAdvancedView && (
                  <div className="p-2 rounded-xl bg-[#090F1C] border border-[#162136] grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-400">
                    <div>Elevation: <span className="text-white font-bold">{item.properties.elevation_m || 482}m AMSL</span></div>
                    <div>Source: <span className="text-blue-400 font-bold">{isFlood ? "EOS-04 C-band" : isRain ? "INSAT-3DS" : "Cartosat-1 DEM"}</span></div>
                    <div>GeoJSON: <span className="text-emerald-400 font-bold">&lt;100 KB Vector</span></div>
                    <div>Delivery: <span className="text-amber-400 font-bold">NavIC / LoRa</span></div>
                  </div>
                )}
              </div>

              {/* Action Strip */}
              <div className="pt-2 border-t border-[#162136] flex items-center justify-between">
                <button
                  onClick={() => onSelectFeature?.(item)}
                  className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center space-x-1"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>Locate on Map</span>
                </button>

                <button
                  onClick={() => handleDispatch(item)}
                  disabled={dispatchingId === item.id}
                  className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-sm disabled:opacity-50"
                >
                  <Send className="w-3 h-3" />
                  <span>{dispatchingId === item.id ? "Transmitting..." : "Broadcast Safe Route"}</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-8 text-center space-y-2">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
          <h3 className="font-bold text-white text-sm">No Alerts Matching Query</h3>
          <p className="text-xs text-slate-400">Try switching filter tabs or clearing your search keywords.</p>
        </div>
      )}
    </div>
  );
}

export default DisasterAlertsView;
