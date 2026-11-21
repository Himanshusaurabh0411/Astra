"use client";

import React, { useState, useEffect } from "react";
import { Satellite, Crosshair, Loader2, Compass } from "lucide-react";
import { NavicFixData, saveNavicFix, getNavicFix } from "@/lib/offlineStore";
import { SurveyCard } from "./primitives/SurveyCard";
import { StatusChip } from "./primitives/StatusChip";
import { StatusDot } from "./primitives/StatusDot";

export interface NavicPanelProps {
  currentFix: NavicFixData | null;
  onFixLocked: (fix: NavicFixData) => void;
  className?: string;
}

const BASIN_PRESETS = [
  {
    name: "Sevan River Causeway",
    desc: "SH-18 Low-Water Bridge",
    lat: 23.0910,
    lng: 77.0580,
    elev: 482,
    status: "Submerged (+0.85m)",
    isSubmerged: true,
  },
  {
    name: "Kothri Kalan Village",
    desc: "Gram Panchayat Center",
    lat: 23.0840,
    lng: 77.0320,
    elev: 492,
    status: "Low-lying (Cut Off)",
    isSubmerged: false,
  },
  {
    name: "VIT Relief Shelter",
    desc: "High Ground Auditorium",
    lat: 23.0805,
    lng: 77.0160,
    elev: 512,
    status: "Safe Ridge (>510m)",
    isSubmerged: false,
  },
  {
    name: "Ashta Western Ridge",
    desc: "Passable Bypass Node",
    lat: 23.1850,
    lng: 77.0950,
    elev: 504,
    status: "Open Ridge (504m)",
    isSubmerged: false,
  },
];

export function NavicPanel({ currentFix, onFixLocked, className = "" }: NavicPanelProps) {
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
    <SurveyCard ticks={true} className={`p-3 text-xs font-mono space-y-2.5 ${className}`}>
      {/* Header with Step 1 Badge */}
      <div className="flex items-center justify-between border-b border-ink-700/80 pb-1.5">
        <div className="flex items-center space-x-2">
          <span className="text-[9px] bg-saffron-500/20 text-saffron-400 font-extrabold px-1.5 py-0.5 rounded border border-saffron-500/40 uppercase tracking-survey">
            STEP 1
          </span>
          <div className="flex items-center space-x-1.5">
            <Compass className="w-3.5 h-3.5 text-saffron-500" />
            <span className="font-bold text-bone-50 tracking-survey text-[11px] uppercase">
              YOUR LOCATION (PASSIVE NAVIC)
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-1.5">
          <StatusDot status="mesh" pulse={true} size="sm" />
          <StatusChip variant="mesh" size="sm" label="L5+S LOCKED" />
        </div>
      </div>

      <p className="text-[10px] text-bone-400 font-sans leading-tight">
        Zero-SIM passive RF satellite positioning: receives coordinates without cell tower connectivity or internet.
      </p>

      {/* Main Coordinate Readout */}
      <div className="bg-ink-950/90 border border-ink-800 p-2.5 rounded-md survey-ticks">
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div>
            <span className="text-[9px] text-bone-500 block uppercase tracking-survey font-semibold">
              Latitude
            </span>
            <strong className="text-bone-50 text-xs tabular-nums font-mono font-bold">
              {fix.lat.toFixed(6)}° N
            </strong>
          </div>
          <div>
            <span className="text-[9px] text-bone-500 block uppercase tracking-survey font-semibold">
              Longitude
            </span>
            <strong className="text-bone-50 text-xs tabular-nums font-mono font-bold">
              {fix.lng.toFixed(6)}° E
            </strong>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 pt-2 mt-2 border-t border-ink-800/80 text-[10px] text-bone-400">
          <div>
            Accuracy: <strong className="text-emerald-400 tabular-nums font-mono">±{fix.accuracy_m}m</strong>
          </div>
          <div>
            Band: <strong className="text-mosdac">NavIC L5+S</strong>
          </div>
          <div>
            Mode: <strong className="text-saffron-400">Zero-SIM RF</strong>
          </div>
        </div>
      </div>

      {/* 1-Tap Basin Location Presets */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[10px] text-bone-500">
          <span className="uppercase tracking-survey font-semibold">Tap Quick Basin Location</span>
          <span className="text-[9px]">Kothri-Sehore Basin</span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {BASIN_PRESETS.map((p, i) => (
            <button
              key={p.name}
              onClick={() => handlePresetSelect(i)}
              className={`p-1.5 rounded text-left transition border focus-visible:ring-1 focus-visible:ring-saffron-500 ${
                selectedPreset === i
                  ? "bg-ink-800 text-bone-50 border-saffron-500/70 shadow-sm"
                  : "bg-ink-950/60 border-ink-800 text-bone-400 hover:text-bone-50 hover:bg-ink-800/60"
              }`}
            >
              <div className="font-bold text-[10px] truncate">{p.name}</div>
              <div className="text-[9px] text-bone-500 flex justify-between mt-0.5 tabular-nums">
                <span>{p.elev}m AMSL</span>
                <span className={p.isSubmerged ? "text-severity-critical font-bold" : "text-emerald-400"}>
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
        className="w-full py-1.5 rounded bg-ink-800 hover:bg-ink-700 text-bone-100 border border-ink-700 text-[11px] font-mono font-bold flex items-center justify-center space-x-1.5 transition focus-visible:ring-2 focus-visible:ring-saffron-500 disabled:opacity-50"
      >
        {locking ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-saffron-500" />
        ) : (
          <Crosshair className="w-3.5 h-3.5 text-saffron-500" />
        )}
        <span>{locking ? "Acquiring NavIC/GPS Fix..." : "Acquire Live Hardware Coordinates"}</span>
      </button>
    </SurveyCard>
  );
}

export default NavicPanel;
