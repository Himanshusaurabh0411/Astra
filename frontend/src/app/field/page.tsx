"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Radio,
  Compass,
  ShieldCheck,
  Building2,
  Route,
  Wifi,
  WifiOff,
  AlertTriangle,
  ArrowLeft,
  Hospital,
  Home,
  CheckCircle2,
  HardDrive,
  Download,
  Map as MapIcon,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import NavicPanel from "@/components/NavicPanel";
import LoraMeshPanel from "@/components/LoraMeshPanel";
import CommandMap from "@/components/CommandMap";
import {
  NavicFixData,
  getCachedFeatures,
  saveCachedFeatures,
  getCachedDispatches,
  saveCachedDispatches,
} from "@/lib/offlineStore";
import {
  GeoJsonFeatureCollection,
  DispatchVector,
  fetchState,
  switchOperationalMode,
  OperationalMode,
} from "@/lib/terrapulseClient";

export default function FieldResponderPage() {
  const [navicFix, setNavicFix] = useState<NavicFixData | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [cachedFeatures, setCachedFeatures] = useState<GeoJsonFeatureCollection | null>(null);
  const [cachedDispatches, setCachedDispatches] = useState<DispatchVector[]>([]);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [mode, setMode] = useState<OperationalMode>("CELL_BLACKOUT_MESH_ACTIVE");

  const [activeLayers, setActiveLayers] = useState({
    mosdac_rain: true,
    bhoonidhi_flood: true,
    vedas_roads: true,
    vedas_corridors: true,
    bhuvan_assets: true,
    sos_mesh: true,
  });

  const toggleLayer = (key: string) => {
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  useEffect(() => {
    // 1. Register PWA Service Worker for zero-connectivity offline operation
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("🛰️ [TerraPulse PWA] Service Worker active:", reg.scope))
        .catch((err) => console.warn("PWA SW registration failed:", err));
    }

    // 2. Monitor browser network state
    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    setIsOnline(navigator.onLine);

    // 3. Load cached GIS vector features & dispatches from local IndexedDB
    getCachedFeatures().then((feat) => {
      if (feat) {
        setCachedFeatures(feat);
        setIsOfflineCached(true);
      }
    });

    getCachedDispatches().then((disp) => {
      if (disp && disp.length > 0) setCachedDispatches(disp);
    });

    // 4. Update cache if network is available
    fetchState()
      .then((live) => {
        setCachedFeatures(live.features);
        saveCachedFeatures(live.features);
        setCachedDispatches(live.dispatches);
        saveCachedDispatches(live.dispatches);
        setMode(live.mode);
        setIsOfflineCached(true);
      })
      .catch((err) => {
        console.warn("Operating offline: utilizing cached local vector store:", err);
      });

    return () => {
      window.removeEventListener("online", updateOnline);
      window.removeEventListener("offline", updateOnline);
    };
  }, []);

  const handleToggleMode = async () => {
    const nextMode = mode === "CELL_BLACKOUT_MESH_ACTIVE" ? "NORMAL" : "CELL_BLACKOUT_MESH_ACTIVE";
    setMode(nextMode);
    try {
      await switchOperationalMode(nextMode);
    } catch (e) {
      console.debug("Mode changed locally (offline):", nextMode);
    }
  };

  const bhuvanAssets = cachedFeatures?.features.filter((f) => f.properties.layer === "bhuvan_assets") || [];
  const safeCorridors = cachedFeatures?.features.filter((f) => f.properties.layer === "vedas_corridors") || [];
  const submergedRoads = cachedFeatures?.features.filter((f) => f.properties.road_status === "SUBMERGED") || [];

  return (
    <div className="flex flex-col min-h-screen bg-[#040711] text-slate-200 font-sans">
      {/* 1. TOP RESPONDER STATUS BAR & NAVIGATION */}
      <header className="h-12 border-b border-slate-800 bg-[#070b15] px-4 flex items-center justify-between sticky top-0 z-30 font-mono text-xs">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="flex items-center space-x-1 text-slate-300 hover:text-white px-2 py-0.5 rounded bg-slate-900 border border-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>CENTRAL C2</span>
          </Link>
          <div className="h-3 w-px bg-slate-800" />
          <div className="flex items-center space-x-1.5">
            <Radio className="w-3.5 h-3.5 text-rose-500 animate-pulse" />
            <span className="font-bold text-white tracking-wider text-[11px]">
              FIELD RESPONDER TERMINAL
            </span>
          </div>
        </div>

        {/* Offline & NavIC Indicators */}
        <div className="flex items-center space-x-2">
          {/* Blackout Mode Switcher */}
          <button
            onClick={handleToggleMode}
            className={`flex items-center space-x-1 px-2 py-0.5 rounded border text-[10px] transition ${
              mode === "CELL_BLACKOUT_MESH_ACTIVE"
                ? "bg-rose-950 text-rose-300 border-rose-800 animate-pulse font-bold"
                : "bg-emerald-950 text-emerald-300 border-emerald-800 font-semibold"
            }`}
            title="Toggle simulated telecom blackout"
          >
            {mode === "CELL_BLACKOUT_MESH_ACTIVE" ? <WifiOff className="w-3 h-3" /> : <Wifi className="w-3 h-3" />}
            <span>{mode === "CELL_BLACKOUT_MESH_ACTIVE" ? "BLACKOUT MESH" : "CELL ONLINE"}</span>
          </button>

          {/* Local Cache Indicator */}
          <div className="flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-900 text-cyan-300 border border-slate-800 text-[10px]">
            <HardDrive className="w-3 h-3" />
            <span>{isOfflineCached ? "STORE: CACHED" : "NO CACHE"}</span>
          </div>
        </div>
      </header>

      {/* 2. MAIN FIELD RESPONDER WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-3 grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* LEFT COLUMN: NavIC Geolocation & LoRa Mesh SOS Composer */}
        <div className="lg:col-span-5 space-y-3">
          {/* Passive NavIC Geolocation */}
          <NavicPanel currentFix={navicFix} onFixLocked={setNavicFix} />

          {/* LoRa 865 MHz Mesh Distress Composer */}
          <LoraMeshPanel navicFix={navicFix} />
        </div>

        {/* RIGHT COLUMN: Cached Corridors, Evacuation Dispatches & Safe Assets */}
        <div className="lg:col-span-7 space-y-3">
          {/* Embedded Tactical Basin GIS Map */}
          <div className="bg-[#0b1120] rounded border border-slate-800 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/80 font-mono text-xs">
              <span className="font-bold text-white flex items-center space-x-1.5 text-[11px]">
                <MapIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>OFFLINE BASIN VECTOR MAP (KOTHRI-SEHORE)</span>
              </span>
              <button
                onClick={() => setShowMap(!showMap)}
                className="text-[10px] text-slate-400 hover:text-white flex items-center space-x-1"
              >
                <span>{showMap ? "COLLAPSE" : "EXPAND"}</span>
                {showMap ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            </div>

            {showMap && (
              <div className="h-64 w-full relative">
                <CommandMap
                  features={cachedFeatures || undefined}
                  dispatches={cachedDispatches}
                  activeLayers={activeLayers}
                  onToggleLayer={toggleLayer}
                  onSelectFeature={setSelectedFeature}
                  selectedItem={selectedFeature}
                />
              </div>
            )}
          </div>

          {/* Road Submergence Hazard Directives */}
          {submergedRoads.length > 0 && (
            <div className="bg-rose-950/40 border border-rose-800 p-2.5 rounded text-xs space-y-1 font-mono">
              <div className="flex items-center space-x-1.5 text-rose-300 font-bold text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span className="uppercase">
                  CRITICAL ROAD SUBMERGENCE DIRECTIVE ({submergedRoads.length} CUT OFF)
                </span>
              </div>
              {submergedRoads.map((road) => (
                <p key={road.id} className="text-slate-300 text-[11px] font-sans pl-5 leading-tight">
                  <strong className="text-white">{road.properties.title}</strong> is cut off under {road.properties.water_depth_m}m floodwater. {road.properties.recommended_action}
                </p>
              ))}
            </div>
          )}

          {/* Active Command Evacuation Dispatches */}
          <div className="bg-[#0b1120] p-3 rounded border border-slate-800 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[11px]">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>ACTIVE C2 EVACUATION DISPATCHES ({cachedDispatches.length})</span>
              </span>
              <span className="text-[10px] text-cyan-400">NavIC / LoRa Vector</span>
            </div>

            <div className="space-y-1.5">
              {cachedDispatches.length === 0 ? (
                <p className="text-[10px] text-slate-500 italic py-1 text-center font-sans">
                  No active evacuation orders. Normal catchment monitoring.
                </p>
              ) : (
                cachedDispatches.map((disp) => (
                  <div
                    key={disp.dispatch_id}
                    className="bg-slate-900 p-2 rounded border border-slate-800 space-y-1"
                  >
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="font-bold text-cyan-400">{disp.dispatch_id}</span>
                      <span className="text-emerald-400 bg-emerald-950/60 px-1.5 py-0.2 rounded border border-emerald-800">
                        SAFE RIDGE VERIFIED
                      </span>
                    </div>
                    <p className="text-slate-200 text-[11px] font-sans leading-tight">
                      {disp.alert_headline}
                    </p>
                    <div className="flex justify-between items-center text-[9px] text-slate-400 pt-1 border-t border-slate-800/80">
                      <span>Target: <strong className="text-white">{disp.safe_asset?.name}</strong></span>
                      <span className="tabular-data">{disp.payload_kb} KB</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Safe Dry Ridge Corridors (VEDAS Cartosat DEM) */}
          <div className="bg-[#0b1120] p-3 rounded border border-slate-800 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[11px]">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <Route className="w-3.5 h-3.5 text-emerald-400" />
                <span>DRY EVACUATION CORRIDORS (CARTOSAT DEM)</span>
              </span>
              <span className="text-[10px] text-emerald-400">&gt;510m AMSL</span>
            </div>

            <div className="space-y-1.5">
              {safeCorridors.map((c) => (
                <div key={c.id} className="bg-slate-900 p-2 rounded border border-slate-800 text-xs space-y-0.5">
                  <div className="flex justify-between items-center text-[11px]">
                    <span className="font-bold text-emerald-400">{c.properties.title}</span>
                    <span className="text-[10px] text-white bg-slate-800 px-1.5 py-0.2 rounded tabular-data">
                      {c.properties.elevation_m}m AMSL
                    </span>
                  </div>
                  <p className="text-slate-300 text-[10px] font-sans leading-tight">
                    {c.properties.recommended_action}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Cadastre Directory (NRSC Bhuvan Cached) */}
          <div className="bg-[#0b1120] p-3 rounded border border-slate-800 space-y-2 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 text-[11px]">
              <span className="font-bold text-white flex items-center space-x-1.5">
                <Building2 className="w-3.5 h-3.5 text-purple-400" />
                <span>CADASTRE ASSET DIRECTORY (OFFLINE CACHED)</span>
              </span>
              <span className="text-[10px] text-slate-400">NRSC Bhuvan</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-xs">
              {bhuvanAssets.map((asset) => {
                const isShelter = asset.properties.asset_type === "SHELTER";
                const isHosp = asset.properties.asset_type === "HOSPITAL";
                return (
                  <div
                    key={asset.id}
                    className={`p-2 rounded border space-y-0.5 ${
                      isShelter
                        ? "bg-emerald-950/25 border-emerald-800"
                        : isHosp
                        ? "bg-rose-950/25 border-rose-800"
                        : "bg-slate-900 border-slate-800"
                    }`}
                  >
                    <div className="flex justify-between items-center font-bold text-white text-[11px]">
                      <span className="truncate">{asset.properties.title.split("(")[0]}</span>
                      <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300">
                        {asset.properties.asset_type}
                      </span>
                    </div>
                    <p className="text-slate-300 text-[10px] font-sans line-clamp-1 leading-tight">
                      {asset.properties.recommended_action}
                    </p>
                    <div className="flex justify-between items-center text-[9px] text-slate-400 pt-0.5 border-t border-slate-800/60">
                      <span>Elev: {asset.properties.elevation_m}m</span>
                      {asset.properties.capacity && (
                        <span className="text-emerald-400 font-bold tabular-data">Cap: {asset.properties.capacity}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
