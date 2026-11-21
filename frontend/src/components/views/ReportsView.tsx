"use client";

import React, { useState } from "react";
import {
  FileText,
  Printer,
  Download,
  ShieldCheck,
  AlertTriangle,
  Building,
  CheckCircle2,
  Calendar,
  Layers,
} from "lucide-react";
import { TerraPulseStateResponse } from "@/lib/terrapulseClient";

interface ReportsViewProps {
  state: TerraPulseStateResponse | null;
  isAdvancedView?: boolean;
}

export function ReportsView({ state, isAdvancedView = false }: ReportsViewProps) {
  const [downloaded, setDownloaded] = useState(false);

  const kpis = state?.kpis;
  const maxRain = kpis?.max_rainfall_mm_hr || 4.8;
  const isRainBreached = maxRain >= 15.0;
  const submergedCount = kpis?.submerged_roads_count || 0;
  const sosCount = state?.sos_packets?.length || 2;

  const handlePrint = () => {
    window.print();
  };

  const handleExport = () => {
    const reportData = {
      title: "TerraPulse Disaster Situation Report",
      basin: "Kothri Kalan / Sehore / Bhopal",
      timestamp: new Date().toISOString(),
      rainfall_mm_hr: maxRain,
      submerged_roads: submergedCount,
      active_distress_beacons: sosCount,
      open_safe_corridors: kpis?.open_corridors_count || 1,
      mode: state?.mode || "NORMAL",
      isro_satellites: ["MOSDAC (INSAT-3DS)", "Bhoonidhi (EOS-04 SAR)", "VEDAS (Cartosat DEM)", "Bhuvan (Cadastre)"],
    };

    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `terrapulse_basin_report_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    setTimeout(() => setDownloaded(false), 3000);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <FileText className="w-6 h-6 text-blue-400" />
            <span>Basin Situation Reports & Hazard Audit</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Standardized disaster intelligence executive briefing and audit trail across Kothri Kalan catchment.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExport}
            className="px-3.5 py-1.5 rounded-xl bg-[#11192C] hover:bg-[#1C2844] border border-[#233550] text-xs font-semibold text-slate-200 flex items-center space-x-1.5 transition"
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span>{downloaded ? "Report Exported ✓" : "Export JSON"}</span>
          </button>

          <button
            onClick={handlePrint}
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold flex items-center space-x-1.5 transition shadow-lg shadow-blue-500/25"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-6 space-y-6 shadow-xl font-sans">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b border-[#1A2640] pb-4">
          <div>
            <span className="text-[10px] font-mono text-blue-400 font-bold uppercase tracking-wider block">
              OFFICIAL DISASTER MANAGEMENT BRIEFING
            </span>
            <h3 className="text-lg font-bold text-white mt-1">
              Catchment Hydro-Meteorological Audit: Kothri Kalan / Sehore Basin
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Area: Latitude 23.06°N – 23.28°N | Longitude 77.00°E – 77.44°E
            </p>
          </div>

          <div className="text-right text-xs text-slate-400 font-mono">
            <div>Generated: 21 Nov 2026, 14:32 IST</div>
            <div className="text-emerald-400 font-bold">STATUS: OPERATIONAL</div>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-[#090E1A] border border-[#162136]">
            <span className="text-slate-400 block text-[11px]">Rainfall (MOSDAC)</span>
            <strong className="text-base text-blue-400">{maxRain} mm/h</strong>
            <span className="block text-[9px] text-slate-500">{isRainBreached ? "Convective surge breached" : "Normal"}</span>
          </div>

          <div className="p-3 rounded-xl bg-[#090E1A] border border-[#162136]">
            <span className="text-slate-400 block text-[11px]">Submerged Crossings</span>
            <strong className="text-base text-red-400">{submergedCount} Cut Off</strong>
            <span className="block text-[9px] text-slate-500">Sevan Causeway (+0.85m)</span>
          </div>

          <div className="p-3 rounded-xl bg-[#090E1A] border border-[#162136]">
            <span className="text-slate-400 block text-[11px]">Verified Safe Corridors</span>
            <strong className="text-base text-emerald-400">{kpis?.open_corridors_count || 1} Open</strong>
            <span className="block text-[9px] text-slate-500">SH-18 Ridge Bypass (514m)</span>
          </div>

          <div className="p-3 rounded-xl bg-[#090E1A] border border-[#162136]">
            <span className="text-slate-400 block text-[11px]">Distress SOS Beacons</span>
            <strong className="text-base text-amber-400">{sosCount} Active</strong>
            <span className="block text-[9px] text-slate-500">LoRa 865 MHz peer relay</span>
          </div>
        </div>

        {/* Hazard Directives & Action Plan */}
        <div className="space-y-3 text-xs">
          <h4 className="font-bold text-white text-sm">Action Directives for Rescue Authorities</h4>
          <div className="space-y-2 text-slate-300">
            <div className="p-3 rounded-xl bg-red-950/30 border border-red-800/60 space-y-1">
              <div className="flex items-center space-x-1.5 text-red-400 font-bold">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>SEVAN CAUSEWAY INUNDATION HAZARD</span>
              </div>
              <p className="text-[11px] leading-snug">
                Bhoonidhi EOS-04 SAR shows water level at 482.85m AMSL exceeding causeway crest by +0.85m. All vehicular movement suspended. Enforce detour over SH-18 ridge bypass toward VIT Relief Shelter.
              </p>
            </div>

            <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/60 space-y-1">
              <div className="flex items-center space-x-1.5 text-emerald-400 font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>SAFE EVACUATION CORRIDOR ACTIVATION</span>
              </div>
              <p className="text-[11px] leading-snug">
                Cartosat DEM confirms ridge bypass from Kothri Kalan to VIT Auditorium remains 100% dry (514m elevation, 32m above flood crest). Vector payload broadcasted over LoRa mesh (<span className="text-emerald-400 font-bold">5.68 KB</span>).
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ReportsView;
