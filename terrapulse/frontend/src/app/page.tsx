"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  fetchState,
  triggerRainfallSpike,
  switchOperationalMode,
  pushEvacuationDispatch,
  resetScenario,
  subscribeToTelemetry,
  TerraPulseStateResponse,
  OperationalMode,
  SOSPacket,
  GeoJsonFeature,
} from "@/lib/terrapulseClient";
import CommandMap from "@/components/CommandMap";
import SectorViews from "@/components/SectorViews";
import JudgeDemoBar from "@/components/JudgeDemoBar";
import {
  Radio,
  CloudRain,
  Waves,
  Route,
  ShieldCheck,
  Building2,
  AlertTriangle,
  Zap,
  RotateCcw,
  Send,
  Wifi,
  WifiOff,
  Compass,
  Layers,
  Activity,
  Wheat,
  Droplets,
  HardDrive,
  Users,
  ChevronRight,
  ExternalLink,
  Info,
  CheckCircle2,
  RefreshCw,
  Signal,
  Satellite,
  Database,
  ArrowRight,
  ChevronLeft,
  Sliders,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";

export default function CentralCommandPage() {
  const [state, setState] = useState<TerraPulseStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<"command" | "agri" | "audit">("command");
  const [drawerOpen, setDrawerOpen] = useState(true);

  const [activeLayers, setActiveLayers] = useState({
    mosdac_rain: true,
    bhoonidhi_flood: true,
    vedas_roads: true,
    vedas_corridors: true,
    bhuvan_assets: true,
    sos_mesh: true,
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadData = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchState();
      setState(data);
      setIsOffline(false);
    } catch (err: any) {
      console.warn("Could not reach backend:", err.message);
      setError("Central Command server unreachable. Retrying over live telemetry loop...");
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

    // Live WebSocket connection to Central Command Telemetry Feed
    const unsubscribe = subscribeToTelemetry((evt) => {
      console.log("🛰️ Telemetry event:", evt.event);
      loadData();
    });

    const handleOnline = () => {
      setIsOffline(false);
      loadData();
    };
    const handleOffline = () => setIsOffline(true);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [loadData]);

  const toggleLayer = (key: string) => {
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleRainSpike = async () => {
    setActionLoading(true);
    try {
      const updated = await triggerRainfallSpike(4.5);
      setState(updated);
      showToast("MOSDAC INSAT-3DS rain spike recorded (>15 mm/h). Bhoonidhi SAR extraction active.");
    } catch (err: any) {
      showToast("Rain spike failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleModeChange = async (mode: OperationalMode) => {
    setActionLoading(true);
    try {
      const updated = await switchOperationalMode(mode);
      setState(updated);
      showToast(`Operational mode: ${mode}`);
    } catch (err: any) {
      showToast("Mode switch failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDispatch = async (overridePayload?: any) => {
    setActionLoading(true);
    try {
      const targetZone = overridePayload?.properties?.title || "ZONE-KOTHRI-KALAN-SOUTH";
      const headline =
        overridePayload?.properties?.recommended_action ||
        "EVACUATION DIRECTIVE: Sevan causeway submerged (+0.85m). Reroute to SH-18 ridge bypass (514m AMSL) toward VIT Shelter.";

      await pushEvacuationDispatch({
        target_zone_id: targetZone,
        alert_headline: headline,
        safe_asset_name: "VIT Bhopal Auditorium & Emergency Shelter",
        safe_lat: 23.0805,
        safe_lng: 77.0160,
      });
      await loadData();
      showToast("Evacuation corridor vector transmitted over tactical mesh.");
    } catch (err: any) {
      showToast("Dispatch error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReset = async () => {
    setActionLoading(true);
    try {
      const updated = await resetScenario();
      setState(updated);
      setSelectedItem(null);
      showToast("Catchment parameters restored to baseline.");
    } catch (err: any) {
      showToast("Reset failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStep1RainSpike = async () => {
    await handleRainSpike();
  };

  const handleStep2SarReroute = async () => {
    setActiveLayers((prev: any) => ({
      ...prev,
      bhoonidhi_flood: true,
      vedas_corridors: true,
      vedas_roads: true,
    }));
    if ((state?.kpis?.max_rainfall_mm_hr || 0) < 15) {
      await handleRainSpike();
    }
    showToast("EOS-04 SAR flood extent mapped; VEDAS Cartosat DEM dry ridge corridor prioritized.");
  };

  const handleStep3CellBlackout = async () => {
    await handleModeChange("CELL_BLACKOUT_MESH_ACTIVE");
    setActiveLayers((prev: any) => ({ ...prev, sos_mesh: true }));
    showToast("Cellular blackout active: LoRa 865.2 MHz mesh + NavIC L5/S locked.");
  };

  const handleStep4VectorPush = async () => {
    await handleDispatch();
    showToast("Evacuation corridor vector (<100 KB) broadcasted to field responders.");
  };

  const kpis = state?.kpis;
  const isRainBreached = (kpis?.max_rainfall_mm_hr || 0) >= 15.0;
  const isRoadSubmerged = (kpis?.submerged_roads_count || 0) > 0;
  const vectorKb = kpis?.payload_kb || 5.68;

  if (loading && !state) {
    return (
      <div className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-300 items-center justify-center p-6 font-mono text-xs select-none">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-3 h-3 rounded-full bg-cyan-500 animate-ping" />
          <span className="font-bold tracking-wider text-slate-100 uppercase">
            TERRAPULSE C2 // CONNECTING DATASTREAM
          </span>
        </div>
        <p className="text-[11px] text-slate-500 max-w-sm text-center">
          Ingesting ISRO feeds: MOSDAC (3DS), Bhoonidhi (EOS-04), VEDAS (Cartosat), Bhuvan (Cadastral)...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen w-screen bg-[#070b14] text-slate-200 overflow-hidden font-sans">
      {/* 1. TOP OPERATIONAL C2 BAR (Compact 48px Header) */}
      <header className="h-12 border-b border-slate-800 bg-[#0b1120] px-4 flex items-center justify-between z-20 flex-shrink-0 text-xs font-mono">
        {/* Brand & ISRO Attribution */}
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold text-sm text-white tracking-wider">
              TERRAPULSE
            </span>
            <span className="text-[10px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
              DISASTER C2
            </span>
          </div>
          <span className="text-slate-600 hidden lg:inline">|</span>
          <span className="text-[10px] text-slate-400 hidden lg:inline">
            FEEDS: MOSDAC · BHOONIDHI · VEDAS · BHUVAN
          </span>
        </div>

        {/* Live Status Indicators */}
        <div className="flex items-center space-x-2">
          {/* Mode Switcher */}
          <div className="flex items-center space-x-0.5 bg-slate-900 border border-slate-800 p-0.5 rounded text-[10px]">
            <button
              onClick={() => handleModeChange("NORMAL")}
              className={`px-2 py-0.5 rounded transition ${
                state?.mode === "NORMAL"
                  ? "bg-emerald-950 text-emerald-300 font-bold border border-emerald-800"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              CELL ONLINE
            </button>
            <button
              onClick={() => handleModeChange("CELL_BLACKOUT_MESH_ACTIVE")}
              className={`px-2 py-0.5 rounded transition ${
                state?.mode === "CELL_BLACKOUT_MESH_ACTIVE"
                  ? "bg-rose-950 text-rose-300 font-bold border border-rose-800 animate-pulse"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              BLACKOUT MESH
            </button>
            <button
              onClick={() => handleModeChange("BACKHAUL_SYNC")}
              className={`px-2 py-0.5 rounded transition ${
                state?.mode === "BACKHAUL_SYNC"
                  ? "bg-amber-950 text-amber-300 font-bold border border-amber-800"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              BURST SYNC
            </button>
          </div>

          {/* Rainfall Threshold Meter */}
          <div
            className={`px-2 py-1 rounded border text-[11px] flex items-center space-x-1.5 ${
              isRainBreached
                ? "bg-rose-950/80 border-rose-700 text-rose-300 font-bold animate-pulse"
                : "bg-slate-900 border-slate-800 text-slate-300"
            }`}
          >
            <CloudRain className="w-3.5 h-3.5 text-cyan-400" />
            <span className="tabular-data">RAIN: {kpis?.max_rainfall_mm_hr || 0} mm/h</span>
            {isRainBreached && <span className="text-[9px] bg-rose-600 text-white px-1 rounded">&gt;15 ALERT</span>}
          </div>

          {/* Sub-100 KB Vector Bandwidth Badge */}
          <div className="hidden sm:flex items-center space-x-1 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-slate-400">VECTOR:</span>
            <strong className="text-emerald-300 tabular-data">{vectorKb} KB</strong>
            <span className="text-[9px] text-slate-500">(&lt;100 KB)</span>
          </div>

          {/* Passive NavIC Status */}
          <div className="hidden md:flex items-center space-x-1.5 px-2 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] text-slate-300">
            <Compass className="w-3.5 h-3.5 text-orange-400" />
            <span>NAVIC L5+S</span>
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          </div>

          {/* Navigation to Tactical Field PWA */}
          <Link
            href="/field"
            className="flex items-center space-x-1 px-2.5 py-1 rounded bg-amber-600 hover:bg-amber-500 text-black font-bold text-[11px] border border-amber-400 transition"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>FIELD PWA</span>
          </Link>
        </div>
      </header>

      {/* ERROR / RECONNECT BANNER */}
      {error && (
        <div className="bg-rose-950 border-b border-rose-800 px-4 py-1.5 flex items-center justify-between text-xs font-mono text-rose-200 z-10 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            <span>{error}</span>
          </div>
          <button
            onClick={loadData}
            className="px-2 py-0.5 rounded bg-rose-900 hover:bg-rose-800 text-white text-[10px] font-bold"
          >
            RETRY
          </button>
        </div>
      )}

      {/* TOAST NOTIFICATION */}
      {toastMessage && (
        <div className="fixed bottom-4 right-4 z-50 px-3 py-2 bg-[#0b1120] border border-slate-700 rounded shadow-xl text-xs font-mono text-cyan-200 flex items-center space-x-2 animate-fadeIn">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 2. MAIN C2 WORKSPACE (Full-bleed Map + Collapsible Operational Drawer) */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Full-Bleed Map Canvas */}
        <div className="flex-1 h-full relative">
          <CommandMap
            features={state?.features}
            sosPackets={state?.sos_packets}
            dispatches={state?.dispatches}
            activeLayers={activeLayers}
            onToggleLayer={toggleLayer}
            onSelectFeature={setSelectedItem}
            selectedItem={selectedItem}
            onDispatchCorridor={handleDispatch}
          />

          {/* Floating Interactive Judge Walkthrough Strip */}
          <div className="absolute top-12 left-3 z-20 w-[calc(100%-1.5rem)] sm:w-[500px] lg:w-[540px]">
            <JudgeDemoBar
              currentMode={state?.mode}
              maxRainfall={kpis?.max_rainfall_mm_hr || 4.8}
              submergedCount={kpis?.submerged_roads_count || 0}
              openCorridorsCount={kpis?.open_corridors_count || 1}
              activeSosCount={state?.sos_packets?.length || 2}
              payloadKb={vectorKb}
              onStep1RainSpike={handleStep1RainSpike}
              onStep2SarReroute={handleStep2SarReroute}
              onStep3CellBlackout={handleStep3CellBlackout}
              onStep4VectorPush={handleStep4VectorPush}
              onResetBasin={handleReset}
            />
          </div>

          {/* Top Control Overlay on Map */}
          <div className="absolute top-3 right-3 flex items-center space-x-2 z-10">
            <button
              onClick={handleRainSpike}
              disabled={actionLoading}
              className="px-2.5 py-1.5 bg-[#0b1120]/95 hover:bg-slate-800 text-cyan-300 border border-slate-700 rounded font-mono text-[11px] font-bold flex items-center space-x-1.5 shadow transition disabled:opacity-50"
              title="Inject extreme rainfall spike (>15 mm/h) to verify SAR flood expansion"
            >
              <Zap className="w-3.5 h-3.5 text-cyan-400" />
              <span>TEST RAIN SPIKE</span>
            </button>

            <button
              onClick={() => handleDispatch()}
              disabled={actionLoading}
              className="px-2.5 py-1.5 bg-[#0b1120]/95 hover:bg-slate-800 text-emerald-300 border border-slate-700 rounded font-mono text-[11px] font-bold flex items-center space-x-1.5 shadow transition disabled:opacity-50"
              title="Broadcast dry evacuation corridor vector to field responders"
            >
              <Send className="w-3.5 h-3.5 text-emerald-400" />
              <span>BROADCAST VECTOR</span>
            </button>

            <button
              onClick={handleReset}
              disabled={actionLoading}
              className="p-1.5 bg-[#0b1120]/95 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-700 rounded shadow transition"
              title="Reset Catchment Baseline"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={() => setDrawerOpen(!drawerOpen)}
              className="p-1.5 bg-[#0b1120]/95 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded shadow transition"
              title={drawerOpen ? "Collapse Intelligence Drawer" : "Open Intelligence Drawer"}
            >
              {drawerOpen ? <PanelRightClose className="w-3.5 h-3.5" /> : <PanelRightOpen className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 3. COLLAPSIBLE RIGHT OPERATIONAL DRAWER (390px Width) */}
        {drawerOpen && (
          <aside className="w-[410px] h-full bg-[#0a0f1d] border-l border-slate-800 flex flex-col flex-shrink-0 z-10 overflow-hidden">
            {/* Drawer Header Tabs */}
            <div className="h-10 border-b border-slate-800 bg-[#080d19] px-2 flex items-center justify-between flex-shrink-0 text-xs font-mono">
              <div className="flex space-x-1">
                <button
                  onClick={() => setActiveTab("command")}
                  className={`px-2.5 py-1 rounded transition text-[11px] ${
                    activeTab === "command"
                      ? "bg-slate-800 text-white font-bold border border-slate-700"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  C2 Triage & SOS
                </button>
                <button
                  onClick={() => setActiveTab("agri")}
                  className={`px-2.5 py-1 rounded transition text-[11px] ${
                    activeTab === "agri"
                      ? "bg-slate-800 text-amber-300 font-bold border border-slate-700"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Agri Stress
                </button>
                <button
                  onClick={() => setActiveTab("audit")}
                  className={`px-2.5 py-1 rounded transition text-[11px] ${
                    activeTab === "audit"
                      ? "bg-slate-800 text-purple-300 font-bold border border-slate-700"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  Hydrology & Dams
                </button>
              </div>

              <span className="text-[10px] text-slate-500 font-bold">
                {state?.features?.features?.length || 10} LAYERS
              </span>
            </div>

            {/* TAB 1: C2 TRIAGE, EVACUATION DISPATCHES & INCOMING DISTRESS BEACONS */}
            {activeTab === "command" && (
              <div className="flex-1 flex flex-col p-3 gap-3 overflow-y-auto">
                {/* Active Evacuation Dispatches */}
                <div className="bg-[#0b1120] border border-slate-800 rounded p-2.5 space-y-2">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 font-mono text-[11px]">
                    <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>EVACUATION DISPATCH VECTORS ({state?.dispatches?.length || 0})</span>
                    </span>
                    <span className="text-[10px] text-cyan-400">NavIC Broadcast</span>
                  </div>

                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {state?.dispatches?.map((disp) => (
                      <div
                        key={disp.dispatch_id}
                        className="bg-slate-900/90 p-2 rounded border border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex justify-between font-mono text-[11px]">
                          <span className="font-bold text-cyan-400">{disp.dispatch_id}</span>
                          <span className="text-slate-400 text-[10px]">{disp.payload_kb} KB</span>
                        </div>
                        <p className="text-slate-300 text-[11px] leading-tight font-sans">
                          {disp.alert_headline}
                        </p>
                        <div className="flex justify-between text-[10px] text-slate-400 font-mono pt-0.5">
                          <span>Target: <strong className="text-slate-200">{disp.safe_asset?.name}</strong></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Real-time Field Distress Beacon Stream */}
                <div className="flex-1 bg-[#0b1120] border border-slate-800 rounded p-2.5 flex flex-col overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 mb-2 font-mono text-[11px] flex-shrink-0">
                    <span className="font-bold text-slate-200 flex items-center space-x-1.5">
                      <Radio className="w-3.5 h-3.5 text-rose-400" />
                      <span>INCOMING DISTRESS PACKETS ({state?.sos_packets?.length || 0})</span>
                    </span>
                    <span className="text-[10px] text-amber-400">865.2 MHz LoRa</span>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                    {state?.sos_packets?.map((sos) => {
                      const isCrit = sos.triage.severity === "CRITICAL";
                      return (
                        <div
                          key={sos.sos_id}
                          onClick={() => setSelectedItem(sos)}
                          className={`p-2.5 rounded border cursor-pointer transition text-xs space-y-1 ${
                            isCrit
                              ? "bg-rose-950/30 border-rose-800 hover:bg-rose-900/40"
                              : "bg-slate-900/80 border-slate-800 hover:bg-slate-800"
                          }`}
                        >
                          <div className="flex justify-between items-center font-mono text-[11px]">
                            <span className="font-bold text-white">{sos.sos_id}</span>
                            <span
                              className={`px-1.5 py-0.2 rounded text-[9px] font-bold ${
                                isCrit ? "bg-rose-600 text-white" : "bg-amber-950 text-amber-300 border border-amber-700"
                              }`}
                            >
                              {sos.triage.severity} ({sos.triage.headcount} pax)
                            </span>
                          </div>
                          <p className="text-slate-300 text-[11px] font-sans line-clamp-2 leading-tight">
                            &quot;{sos.triage.note}&quot;
                          </p>
                          <div className="flex justify-between items-center text-[10px] text-slate-400 font-mono pt-1 border-t border-slate-800/60">
                            <span>Mesh: {sos.mesh.hop_count} hops</span>
                            <span className="text-cyan-400">{sos.mesh.sync_status}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Catchment Asset Quick Summary */}
                <div className="bg-[#0b1120] border border-slate-800 rounded p-2.5 font-mono text-xs">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    CATCHMENT CRITICAL ASSET STATUS
                  </span>
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-400">VIT Relief Shelter:</span>
                      <strong className="block text-emerald-400">512m AMSL (SAFE)</strong>
                    </div>
                    <div className="bg-slate-900 p-1.5 rounded border border-slate-800">
                      <span className="text-slate-400">Sevan Causeway:</span>
                      <strong className={`block ${isRoadSubmerged ? "text-rose-400" : "text-emerald-400"}`}>
                        {isRoadSubmerged ? "SUBMERGED (+0.85m)" : "PASSABLE"}
                      </strong>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2 & 3: MULTI-SECTOR INTELLIGENCE VIEWS */}
            {activeTab === "agri" && (
              <SectorViews
                state={state}
                activeSector="agri"
                onTriggerClaim={(blk) => showToast(`PMFBY claim registered for ${blk}`)}
                onDispatchCorridor={handleDispatch}
              />
            )}

            {activeTab === "audit" && (
              <SectorViews
                state={state}
                activeSector="audit"
                onDispatchCorridor={handleDispatch}
              />
            )}
          </aside>
        )}
      </div>
    </div>
  );
}
