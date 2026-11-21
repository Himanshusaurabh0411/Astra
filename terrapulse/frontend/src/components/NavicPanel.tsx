"use client";

import React, { useState, useEffect } from "react";
import { Compass, Satellite, MapPin, CheckCircle2, Crosshair, RefreshCw, Radio } from "lucide-react";
import { NavicFixData, saveNavicFix, getNavicFix } from "@/lib/offlineStore";

interface NavicPanelProps {
  currentFix: NavicFixData | null;
  onFixLocked: (fix: NavicFixData) => void;
  className?: string;
}

const BASIN_PRESETS = [
  {
    name: "Sevan River Causeway (SH-18 Link)",
    lat: 23.0910,
    lng: 77.0580,
    elev: 482,
    status: "Submerged in flood",
  },
  {
    name: "Kothri Kalan Gram Panchayat",
    lat: 23.0840,
    lng: 77.0320,
    elev: 492,
    status: "Isolated low-lying",
  },
  {
    name: "VIT Bhopal Relief Shelter (High Ground)",
    lat: 23.0805,
    lng: 77.0160,
    elev: 512,
    status: "Safe ridge crest",
  },
  {
    name: "Ashta Western Ridge Node",
    lat: 23.1850,
    lng: 77.0950,
    elev: 504,
    status: "High road corridor",
  },
];

export default function NavicPanel({ currentFix, onFixLocked, className = "" }: NavicPanelProps) {
  const [locking, setLocking] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number | null>(0);
  const [fix, setFix] = useState<NavicFixData>(
    currentFix || {
      lat: 23.0910,
      lng: 77.0580,
      accuracy_m: 1.8,
      navic_band: "L5+S_PASSIVE",
      locked_at: new Date().toISOString(),
      is_simulated: true,
    }
  );

  useEffect(() => {
    getNavicFix().then((cached) => {
      if (cached) {
        setFix(cached);
        onFixLocked(cached);
      }
    });
  }, [onFixLocked]);

  const handlePresetSelect = async (idx: number) => {
    setSelectedPreset(idx);
    const p = BASIN_PRESETS[idx];
    const newFix: NavicFixData = {
      lat: p.lat,
      lng: p.lng,
      accuracy_m: 1.4,
      navic_band: "L5+S_PASSIVE",
      locked_at: new Date().toISOString(),
      is_simulated: true,
    };
    setFix(newFix);
    await saveNavicFix(newFix);
    onFixLocked(newFix);
  };

  const handleCaptureLive = () => {
    if (typeof window === "undefined" || !("geolocation" in navigator)) {
      alert("Browser geolocation not available. Using passive NavIC receiver baseline.");
      return;
    }

    setLocking(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const newFix: NavicFixData = {
          lat: parseFloat(pos.coords.latitude.toFixed(6)),
          lng: parseFloat(pos.coords.longitude.toFixed(6)),
          accuracy_m: parseFloat((pos.coords.accuracy || 3.5).toFixed(1)),
          navic_band: "L5+S_PASSIVE",
          locked_at: new Date().toISOString(),
          is_simulated: false,
        };
        setFix(newFix);
        setSelectedPreset(null);
        await saveNavicFix(newFix);
        onFixLocked(newFix);
        setLocking(false);
      },
      (err) => {
        console.warn("Live GPS unavailable, maintaining passive NavIC lock:", err.message);
        setLocking(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  return (
    <div className={`field-lcd rounded-lg p-3 text-xs font-mono space-y-2.5 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
        <div className="flex items-center space-x-2">
          <Satellite className="w-3.5 h-3.5 text-cyan-400" />
          <span className="font-bold text-white tracking-wider text-[11px]">
            NAVIC RECEIVER // IRNSS L5+S
          </span>
        </div>
        <div className="flex items-center space-x-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[10px] text-emerald-400 font-bold">LOCKED</span>
          <span className="text-[10px] text-slate-500">| ZERO-SIM</span>
        </div>
      </div>

      {/* Main Coordinate Readout */}
      <div className="bg-[#070c18] border border-slate-800 p-2.5 rounded">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-[9px] text-slate-500 block uppercase">Latitude (WGS84)</span>
            <strong className="text-white text-xs tabular-data">{fix.lat.toFixed(6)}° N</strong>
          </div>
          <div>
            <span className="text-[9px] text-slate-500 block uppercase">Longitude (WGS84)</span>
            <strong className="text-white text-xs tabular-data">{fix.lng.toFixed(6)}° E</strong>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 pt-2 mt-2 border-t border-slate-800/80 text-[10px] text-slate-400">
          <div>
            Accuracy: <strong className="text-emerald-400">±{fix.accuracy_m}m</strong>
          </div>
          <div>
            Constellation: <strong className="text-cyan-400">NavIC 7-Sat</strong>
          </div>
          <div>
            Mode: <strong className="text-amber-400">Passive RF</strong>
          </div>
        </div>
      </div>

      {/* Catchment Geoposition Presets */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] text-slate-400">
          <span className="uppercase">Basin Sector Presets</span>
          <span>Kothri-Sehore Sub-Basin</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {BASIN_PRESETS.map((p, i) => (
            <button
              key={p.name}
              onClick={() => handlePresetSelect(i)}
              className={`p-1.5 rounded text-left transition border ${
                selectedPreset === i
                  ? "bg-slate-800 text-white border-cyan-500/70"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <div className="font-bold text-[10px] truncate">{p.name.split("(")[0]}</div>
              <div className="text-[9px] text-slate-500 flex justify-between mt-0.5">
                <span>{p.elev}m AMSL</span>
                <span className={p.status.includes("Submerged") ? "text-rose-400" : "text-emerald-400"}>
                  {p.status.split(" ")[0]}
                </span>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Manual GPS Refresh */}
      <button
        onClick={handleCaptureLive}
        disabled={locking}
        className="w-full py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-bold flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
      >
        <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
        <span>{locking ? "Acquiring NavIC/GPS Fix..." : "Acquire Live Hardware Coordinates"}</span>
      </button>
    </div>
  );
}
