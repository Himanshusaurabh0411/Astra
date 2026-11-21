"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Radio,
  ShieldCheck,
  Building2,
  Route,
  Wifi,
  WifiOff,
  AlertTriangle,
  ArrowLeft,
  HardDrive,
  Map as MapIcon,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  CheckCircle2,
  ChevronRight,
  Compass,
  Send,
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
  getQueuedOfflineSOS,
  updateQueuedOfflineSOS,
} from "@/lib/offlineStore";
import {
  GeoJsonFeatureCollection,
  DispatchVector,
  SOSPacket,
  fetchState,
  switchOperationalMode,
  OperationalMode,
  submitSOSPacket,
} from "@/lib/terrapulseClient";

export default function FieldResponderPage() {
  const [navicFix, setNavicFix] = useState<NavicFixData | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [cachedFeatures, setCachedFeatures] = useState<GeoJsonFeatureCollection | null>(null);
  const [cachedDispatches, setCachedDispatches] = useState<DispatchVector[]>([]);
  const [sosPackets, setSosPackets] = useState<SOSPacket[]>([]);
  const [isOfflineCached, setIsOfflineCached] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [mode, setMode] = useState<OperationalMode>("CELL_BLACKOUT_MESH_ACTIVE");
  const [syncingAll, setSyncingAll] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

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

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 3500);
  };

  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => console.log("🛰️ [TerraPulse PWA] Service Worker active:", reg.scope))
        .catch((err) => console.warn("PWA SW registration failed:", err));
    }

    const updateOnline = () => setIsOnline(navigator.onLine);
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    setIsOnline(navigator.onLine);

    getCachedFeatures().then((feat) => {
      if (feat) {
        setCachedFeatures(feat);
        setIsOfflineCached(true);
      }
    });

    getCachedDispatches().then((disp) => {
      if (disp && disp.length > 0) setCachedDispatches(disp);
    });

    getQueuedOfflineSOS().then((sos) => {
      if (sos && sos.length > 0) setSosPackets(sos);
    });

    fetchState()
      .then((live) => {
        setCachedFeatures(live.features);
        saveCachedFeatures(live.features);
        setCachedDispatches(live.dispatches);
        saveCachedDispatches(live.dispatches);
        if (live.sos_packets && live.sos_packets.length > 0) {
          setSosPackets(live.sos_packets);
        }
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
      showFeedback(`Operational mode switched to ${nextMode}`);
    } catch (e) {
      console.debug("Mode changed locally (offline):", nextMode);
      showFeedback(`Switched to ${nextMode} (Offline Mode)`);
    }
  };

  const handleSyncAllPackets = async () => {
    setSyncingAll(true);
    let syncedCount = 0;
    try {
      for (const pkt of sosPackets) {
        if (pkt.mesh.sync_status !== "SYNCED_COMMAND") {
          try {
            await submitSOSPacket(pkt);
            const synced: SOSPacket = {
              ...pkt,
              mesh: { ...pkt.mesh, sync_status: "SYNCED_COMMAND" },
            };
            await updateQueuedOfflineSOS(synced);
            setSosPackets((prev) => prev.map((p) => (p.sos_id === pkt.sos_id ? synced : p)));
            syncedCount++;
          } catch (err) {
            console.warn("Sync failed for packet:", pkt.sos_id);
          }
        }
      }
      showFeedback(
        syncedCount > 0
          ? `Successfully synced ${syncedCount} packet(s) to Central Base.`
          : "All emergency packets are already synced."
      );
    } finally {
      setSyncingAll(false);
    }
  };

  const bhuvanAssets = cachedFeatures?.features.filter((f) => f.properties.layer === "bhuvan_assets") || [];
  const safeCorridors = cachedFeatures?.features.filter((f) => f.properties.layer === "vedas_corridors") || [];
  const submergedRoads = cachedFeatures?.features.filter((f) => f.properties.road_status === "SUBMERGED") || [];

  return (
    <div className="flex flex-col min-h-screen bg-[#070B14] text-white font-sans">
      {/* 1. TOP UTILITY HEADER BAR */}
      <header className="h-16 border-b border-[#131D31] bg-[#0A0F1D]/80 backdrop-blur-md px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30 font-sans">
        <div className="flex items-center space-x-3">
          <Link
            href="/"
            className="flex items-center space-x-1.5 text-slate-300 hover:text-white px-3 py-1.5 rounded-xl bg-[#10192C] border border-[#1E293B] transition text-xs font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Command C2</span>
          </Link>

          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-white font-bold">TerraPulse</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-blue-400 font-semibold">Tactical Field Responder</span>
          </div>
        </div>

        {/* Right Status Controls */}
        <div className="flex items-center space-x-2.5">
          {/* Blackout Mode Switcher */}
          <button
            onClick={handleToggleMode}
            className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border text-xs font-semibold transition ${
              mode === "CELL_BLACKOUT_MESH_ACTIVE"
                ? "bg-rose-950/70 border-rose-700/80 text-rose-300 animate-pulse"
                : "bg-emerald-950/60 border-emerald-800/80 text-emerald-400"
            }`}
            title="Toggle simulated telecom blackout"
          >
            {mode === "CELL_BLACKOUT_MESH_ACTIVE" ? <WifiOff className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5" />}
            <span>{mode === "CELL_BLACKOUT_MESH_ACTIVE" ? "Blackout (LoRa Mesh)" : "Cell Online"}</span>
          </button>

          {/* Local Cache Indicator */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-[#10192C] text-emerald-400 border border-[#1E293B] text-[11px] font-mono font-bold">
            <HardDrive className="w-3 h-3 text-emerald-400" />
            <span>{isOfflineCached ? "Saved Offline" : "Online"}</span>
          </div>
        </div>
      </header>

      {/* FEEDBACK TOAST BANNER */}
      {feedbackMsg && (
        <div className="fixed bottom-4 right-4 z-50 px-3.5 py-2.5 bg-[#0F172A] border border-blue-500/60 rounded-xl shadow-2xl text-xs text-white flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{feedbackMsg}</span>
        </div>
      )}

      {/* 2. 3-STEP RESPONDER FLOW WORKSPACE */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* LEFT COLUMN: Step 1 (NavIC Geolocation) & Step 2 (LoRa SOS Composer) */}
        <div className="lg:col-span-5 space-y-5">
          {/* STEP 1: Your Location (Passive NavIC) */}
          <NavicPanel currentFix={navicFix} onFixLocked={setNavicFix} />

          {/* STEP 2: Send Help Request (LoRa SOS) */}
          <LoraMeshPanel
            navicFix={navicFix}
            onPacketQueued={(pkt) => setSosPackets((prev) => [pkt, ...prev.filter((p) => p.sos_id !== pkt.sos_id)])}
          />
        </div>

        {/* RIGHT COLUMN: Step 3 (Safe Route, Evacuation Vectors & Basin Map) */}
        <div className="lg:col-span-7 space-y-5">
          {/* STEP 3 CONTAINER CARD */}
          <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
            {/* Step 3 Header */}
            <div className="flex items-center justify-between border-b border-[#1A2640] pb-3">
              <div className="flex items-center space-x-2.5">
                <span className="text-[10px] bg-emerald-500/20 text-emerald-400 font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/40 uppercase tracking-wide">
                  STEP 3
                </span>
                <div className="flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <h3 className="font-bold text-sm text-white">SAFE ROUTE & BASE SYNC</h3>
                </div>
              </div>

              {/* Sync to Base Action */}
              <button
                onClick={handleSyncAllPackets}
                disabled={syncingAll}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition text-xs font-bold disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? "animate-spin" : ""}`} />
                <span>{syncingAll ? "Syncing..." : "Sync Packets to Base"}</span>
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-snug">
              Pre-cached Cartosat DEM dry corridors (&gt;510m AMSL), incoming evacuation directives, and nearby high-ground shelters.
            </p>

            {/* Road Submergence Hazard Directives */}
            {submergedRoads.length > 0 && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 text-xs space-y-1">
                <div className="flex items-center space-x-1.5 text-rose-300 font-bold">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>HAZARD ALERT: {submergedRoads.length} ROAD(S) CUT OFF</span>
                </div>
                {submergedRoads.map((road) => (
                  <p key={road.id} className="text-slate-300 text-xs pl-5 leading-tight">
                    <strong className="text-white">{road.properties.title}</strong> is submerged under +{road.properties.water_depth_m}m water. {road.properties.recommended_action}
                  </p>
                ))}
              </div>
            )}

            {/* Active Command Evacuation Dispatches */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center space-x-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Incoming Command Directives ({cachedDispatches.length})</span>
                </span>
                <span className="text-[10px] text-amber-400 font-mono">NavIC Broadcast</span>
              </div>

              {cachedDispatches.length === 0 ? (
                <p className="text-xs text-slate-500 italic py-1 text-center">
                  No active evacuation directives issued. Normal catchment monitoring.
                </p>
              ) : (
                cachedDispatches.map((disp) => (
                  <div
                    key={disp.dispatch_id}
                    className="bg-[#090E1A] p-2.5 rounded-xl border border-[#162136] space-y-1 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-amber-400 font-mono text-[11px]">{disp.dispatch_id}</span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold">
                        DRY RIDGE DIRECTIVE
                      </span>
                    </div>
                    <p className="text-slate-200 text-xs leading-snug">
                      {disp.alert_headline}
                    </p>
                    <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-[#141C2E]">
                      <span>Safe Target: <strong className="text-white">{disp.safe_asset?.name}</strong></span>
                      <span className="text-emerald-400 font-mono font-bold">{disp.payload_kb} KB</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Safe Dry Ridge Corridors (VEDAS Cartosat DEM) */}
            <div className="space-y-2 pt-2 border-t border-[#1A2640]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center space-x-1.5">
                  <Route className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Dry Evacuation Corridors</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">&gt;510m AMSL (Safe)</span>
              </div>

              {safeCorridors.map((c) => (
                <div key={c.id} className="bg-[#090E1A] p-2.5 rounded-xl border border-[#162136] text-xs space-y-0.5">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-emerald-400">{c.properties.title}</span>
                    <span className="text-[10px] text-white bg-[#162136] px-2 py-0.5 rounded font-mono font-bold">
                      {c.properties.elevation_m}m AMSL
                    </span>
                  </div>
                  <p className="text-slate-300 text-xs leading-snug">
                    {c.properties.recommended_action}
                  </p>
                </div>
              ))}
            </div>

            {/* Safe Shelters & Hospitals (NRSC Bhuvan Cached) */}
            <div className="space-y-2 pt-2 border-t border-[#1A2640]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-bold text-white flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-purple-400" />
                  <span>Nearby Shelters & Relief Centers</span>
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Bhuvan Cadastres</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {bhuvanAssets.map((asset) => {
                  const isShelter = asset.properties.asset_type === "SHELTER";
                  const isHosp = asset.properties.asset_type === "HOSPITAL";
                  return (
                    <div
                      key={asset.id}
                      className={`p-2.5 rounded-xl border space-y-1 ${
                        isShelter
                          ? "bg-emerald-950/20 border-emerald-800/60"
                          : isHosp
                          ? "bg-rose-950/20 border-rose-800/60"
                          : "bg-[#090E1A] border-[#162136]"
                      }`}
                    >
                      <div className="flex justify-between items-center font-bold text-white text-xs">
                        <span className="truncate">{asset.properties.title.split("(")[0]}</span>
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#162136] text-slate-300">
                          {asset.properties.asset_type}
                        </span>
                      </div>
                      <p className="text-slate-300 text-[11px] line-clamp-1 leading-snug">
                        {asset.properties.recommended_action}
                      </p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-[#141C2E]">
                        <span>Elev: {asset.properties.elevation_m}m</span>
                        {asset.properties.capacity && (
                          <span className="text-emerald-400 font-bold">Cap: {asset.properties.capacity}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Embedded Tactical Basin GIS Map */}
          <div className="bg-[#0D1526] border border-[#1A2640] rounded-2xl overflow-hidden shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#1A2640] bg-[#090E1A] text-xs">
              <span className="font-bold text-white flex items-center space-x-2">
                <MapIcon className="w-4 h-4 text-blue-400" />
                <span>OFFLINE BASIN VECTOR MAP (KOTHRI-SEHORE)</span>
              </span>
              <button
                onClick={() => setShowMap(!showMap)}
                className="text-xs text-slate-400 hover:text-white flex items-center space-x-1"
              >
                <span>{showMap ? "COLLAPSE" : "EXPAND"}</span>
                {showMap ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            {showMap && (
              <div className="h-72 w-full relative">
                <CommandMap
                  features={cachedFeatures || undefined}
                  sosPackets={sosPackets}
                  dispatches={cachedDispatches}
                  activeLayers={activeLayers}
                  onToggleLayer={toggleLayer}
                  onSelectFeature={setSelectedFeature}
                  selectedItem={selectedFeature}
                />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
