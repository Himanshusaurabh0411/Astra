"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
} from "@/lib/terrapulseClient";
import CommandMap from "@/components/CommandMap";
import { Sparkline } from "@/components/primitives/Sparkline";
import DisasterAlertsView from "@/components/views/DisasterAlertsView";
import AgricultureView from "@/components/views/AgricultureView";
import HydrologyView from "@/components/views/HydrologyView";
import AnalyticsView from "@/components/views/AnalyticsView";
import MapLayersView from "@/components/views/MapLayersView";
import EmergencySOSView from "@/components/views/EmergencySOSView";
import ReportsView from "@/components/views/ReportsView";
import SettingsView from "@/components/views/SettingsView";
import {
  Home,
  Bell,
  Sprout,
  Droplets,
  BarChart3,
  Layers,
  Radio,
  FileText,
  Settings,
  Search,
  Calendar,
  Users,
  Shield,
  Activity,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Send,
  Zap,
  WifiOff,
  RotateCcw,
  Sparkles,
  MapPin,
  Clock,
  ExternalLink,
  Menu,
  X,
  Sliders,
  ChevronRight,
  Info,
  HelpCircle,
  Eye,
} from "lucide-react";

export type NavItem =
  | "dashboard"
  | "alerts"
  | "agriculture"
  | "hydrology"
  | "analytics"
  | "layers"
  | "sos"
  | "reports"
  | "settings";

export default function CentralCommandDashboard() {
  const [state, setState] = useState<TerraPulseStateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeNav, setActiveNav] = useState<NavItem>("dashboard");
  const [inspectorTab, setInspectorTab] = useState<"details" | "impact" | "resources">("details");
  const [isAdvancedView, setIsAdvancedView] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);

  // Geospatial Layer Toggles
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
      setError("Central Command backend unreachable. Operating on cached local basin state.");
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();

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

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        document.getElementById("global-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      unsubscribe();
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loadData]);

  const toggleLayer = (key: string) => {
    setActiveLayers((prev: any) => ({ ...prev, [key]: !prev[key] }));
  };

  // Scenario Triggers (With Plain-English Confirmation)
  const handleRainSpike = async () => {
    setActionLoading(true);
    try {
      const updated = await triggerRainfallSpike(4.5);
      setState(updated);
      showToast("🌧️ Heavy storm simulated! The map now shows roads affected by sudden cloudburst.");
    } catch (err: any) {
      showToast("Rain simulation error: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleModeChange = async (mode: OperationalMode) => {
    setActionLoading(true);
    try {
      const updated = await switchOperationalMode(mode);
      setState(updated);
      showToast(
        mode === "CELL_BLACKOUT_MESH_ACTIVE"
          ? "📶 Mobile network outage simulated! Offline emergency radios are now active."
          : "📶 Mobile network restored to normal."
      );
    } catch (err: any) {
      showToast("Network switch error: " + err.message);
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
        "SAFETY NOTICE: Sevan causeway flooded (+0.85m). Please take Highway 18 hill bypass toward VIT Shelter.";

      await pushEvacuationDispatch({
        target_zone_id: targetZone,
        alert_headline: headline,
        safe_asset_name: "VIT Bhopal Auditorium & Emergency Shelter",
        safe_lat: 23.0805,
        safe_lng: 77.0160,
      });
      await loadData();
      showToast("📢 Safe route notice sent to all rescue teams and local radios!");
    } catch (err: any) {
      showToast("Send error: " + err.message);
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
      showToast("🔄 Map reset to normal sunny day baseline. All roads open.");
    } catch (err: any) {
      showToast("Reset failed: " + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const kpis = state?.kpis;
  const isRainBreached = (kpis?.max_rainfall_mm_hr || 0) >= 15.0;
  const isBlackout = state?.mode === "CELL_BLACKOUT_MESH_ACTIVE";
  const vectorKb = kpis?.payload_kb || 5.68;

  // Search Filtering
  const searchResults = useMemo(() => {
    if (!searchQuery.trim() || !state?.features?.features) return [];
    const q = searchQuery.toLowerCase();
    return state.features.features.filter(
      (f) =>
        f.properties.title?.toLowerCase().includes(q) ||
        f.properties.recommended_action?.toLowerCase().includes(q) ||
        f.properties.layer?.toLowerCase().includes(q)
    );
  }, [searchQuery, state?.features]);

  // Breadcrumbs
  const breadcrumbName = useMemo(() => {
    switch (activeNav) {
      case "dashboard": return "Live Map & Safety Dashboard";
      case "alerts": return "Active Flood Warnings";
      case "agriculture": return "Farm & Crop Damage";
      case "hydrology": return "Dam & River Water Levels";
      case "analytics": return "Safety Trends & Speed";
      case "layers": return "Map Controls";
      case "sos": return "Calls for Help (SOS)";
      case "reports": return "Printable Situation Report";
      case "settings": return "Test Disaster Simulations";
      default: return "Live Dashboard";
    }
  }, [activeNav]);

  const notifications = [
    { id: 1, title: "⛈️ Heavy Storm Warning", time: "14:20", text: "Heavy rain cloudburst detected over Kothri Kalan basin", type: "critical" },
    { id: 2, title: "🌊 Bridge Under Water", time: "13:50", text: "Sevan River bridge is flooded (+2.5 feet). Road closed.", type: "warning" },
    { id: 3, title: "🟢 Safe Road Open", time: "12:30", text: "Highway 18 hill route is 100% dry and open to shelters", type: "safe" },
    { id: 4, title: "📻 Emergency Radios Ready", time: "11:15", text: "Walkie-talkie mesh is online and relaying messages", type: "mesh" },
  ];

  if (loading && !state) {
    return (
      <div className="flex flex-col h-screen w-screen bg-[#070B14] text-slate-300 items-center justify-center p-6 font-sans text-xs select-none">
        <div className="flex items-center space-x-3 mb-3">
          <div className="w-4 h-4 rounded-full bg-blue-500 animate-ping" />
          <span className="font-bold text-white tracking-wider text-sm">
            LOADING TERRAPULSE DISASTER MAP...
          </span>
        </div>
        <p className="text-xs text-slate-400 max-w-sm text-center">
          Connecting to weather satellites and live ground sensors to show safe roads.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[#070B14] text-white font-sans overflow-hidden">
      {/* ============================================================ */}
      {/* 1. PERSISTENT LEFT SIDEBAR (Friendly & Plain English)        */}
      {/* ============================================================ */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#090E1A] border-r border-[#162136] flex flex-col justify-between p-4 flex-shrink-0 transition-transform duration-200 lg:static lg:translate-x-0 ${
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="space-y-5 overflow-y-auto pr-1">
          {/* Top Brand Block matching screenshot */}
          <div className="flex items-center justify-between px-1 pt-1">
            <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveNav("dashboard")}>
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-blue-500 flex items-center justify-center shadow-lg shadow-teal-500/20 flex-shrink-0">
                <span className="text-base">🌐</span>
              </div>
              <div>
                <h1 className="font-bold text-base tracking-tight text-white leading-none">
                  TerraPulse
                </h1>
                <p className="text-[10px] text-slate-400 font-medium tracking-wide mt-1">
                  Monitor · Analyse · Act
                </p>
              </div>
            </div>

            <button
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden text-slate-400 hover:text-white p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Menu matching reference screenshot */}
          <nav className="space-y-1.5 text-xs">
            {/* 1. Dashboard */}
            <button
              onClick={() => { setActiveNav("dashboard"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold transition ${
                activeNav === "dashboard"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "text-slate-400 hover:text-white hover:bg-[#11192C]"
              }`}
            >
              <Home className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            {/* 2. Disaster Alerts */}
            <button
              onClick={() => { setActiveNav("alerts"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold transition ${
                activeNav === "alerts"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "text-slate-400 hover:text-white hover:bg-[#11192C]"
              }`}
            >
              <div className="flex items-center space-x-3">
                <Bell className="w-4 h-4" />
                <span>Disaster Alerts</span>
              </div>
              <span className="w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                {isRainBreached ? "4" : "3"}
              </span>
            </button>

            {/* 3. Analytics */}
            <button
              onClick={() => { setActiveNav("analytics"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold transition ${
                activeNav === "analytics"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "text-slate-400 hover:text-white hover:bg-[#11192C]"
              }`}
            >
              <BarChart3 className="w-4 h-4 text-purple-400" />
              <span>Analytics</span>
            </button>

            {/* 4. Layers */}
            <button
              onClick={() => { setActiveNav("layers"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold transition ${
                activeNav === "layers"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "text-slate-400 hover:text-white hover:bg-[#11192C]"
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Layers</span>
            </button>

            {/* 5. Reports */}
            <button
              onClick={() => { setActiveNav("reports"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold transition ${
                activeNav === "reports"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "text-slate-400 hover:text-white hover:bg-[#11192C]"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>Reports</span>
            </button>

            {/* 6. Settings */}
            <button
              onClick={() => { setActiveNav("settings"); setMobileMenuOpen(false); }}
              className={`w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl font-semibold transition ${
                activeNav === "settings"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-500/25"
                  : "text-slate-400 hover:text-white hover:bg-[#11192C]"
              }`}
            >
              <Settings className="w-4 h-4" />
              <span>Settings</span>
            </button>

            {/* Field Responder Link */}
            <Link
              href="/field"
              className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl font-semibold text-slate-400 hover:text-white hover:bg-[#11192C] transition group mt-2"
            >
              <div className="flex items-center space-x-3">
                <Radio className="w-4 h-4 text-amber-400 group-hover:text-amber-300" />
                <span>Field Responder</span>
              </div>
              <span className="text-[9px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">
                Mesh
              </span>
            </Link>
          </nav>
        </div>

        {/* Bottom Card matching reference screenshot */}
        <div className="space-y-3 pt-3 border-t border-[#162136]">
          <div className="relative rounded-2xl overflow-hidden border border-[#1C2842] shadow-xl group">
            <img
              src="/building-card.png"
              alt="Building a Safer, Smarter India"
              className="w-full h-28 object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#070B14]/95 via-[#070B14]/40 to-transparent flex flex-col justify-end p-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-1">
                <Sprout className="w-3.5 h-3.5" />
              </div>
              <div className="font-bold text-xs text-white leading-tight">
                Building a<br />Safer, Smarter India
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 text-center font-sans">
            Powered by ISRO · TerraPulse v1.0
          </p>
        </div>
      </aside>

      {/* ============================================================ */}
      {/* MAIN CONTENT AREA                                            */}
      {/* ============================================================ */}
      <main className="flex-1 flex flex-col min-w-0 h-full overflow-y-auto bg-[#070B14]">
        {/* ============================================================ */}
        {/* 2. TOP FRIENDLY UTILITY HEADER BAR                           */}
        {/* ============================================================ */}
        <header className="h-16 px-4 sm:px-6 border-b border-[#131D31] bg-[#0A0F1D]/80 backdrop-blur-md flex items-center justify-between sticky top-0 z-20 flex-shrink-0">
          <div className="flex items-center space-x-3 w-full max-w-2xl">
            {/* Mobile Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden text-slate-400 hover:text-white p-1"
            >
              <Menu className="w-5 h-5" />
            </button>

            {/* Breadcrumb Path */}
            <div className="hidden sm:flex items-center space-x-1.5 text-xs text-slate-400 font-medium">
              <span className="text-white font-bold cursor-pointer" onClick={() => setActiveNav("dashboard")}>
                TerraPulse
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
              <span className="text-blue-400 font-semibold">{breadcrumbName}</span>
            </div>

            {/* Global Search Bar matching reference screenshot */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="global-search-input"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Search location, region or event... (e.g. "Bihar, flood")'
                className="w-full bg-[#101728] border border-[#1C2740] rounded-xl pl-9 pr-12 py-2 text-xs text-slate-200 placeholder:text-slate-400 focus:outline-none focus:border-blue-500 transition shadow-inner"
              />
              <kbd className="hidden sm:inline-block absolute right-3 top-1/2 -translate-y-1/2 px-1.5 py-0.5 rounded bg-[#162136] border border-[#21314F] text-[10px] text-slate-400 font-mono">
                ⌘K
              </kbd>

              {/* Autocomplete Search Dropdown */}
              {searchResults.length > 0 && (
                <div className="absolute left-0 right-0 top-full mt-1.5 bg-[#0F172A] border border-[#1E293B] rounded-xl shadow-2xl p-2 z-50 max-h-60 overflow-y-auto space-y-1">
                  {searchResults.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => {
                        setSelectedItem(item);
                        setSearchQuery("");
                        setActiveNav("dashboard");
                      }}
                      className="p-2 rounded-lg hover:bg-[#1E293B] cursor-pointer flex justify-between items-center text-xs"
                    >
                      <div>
                        <div className="font-semibold text-white">{item.properties.title}</div>
                        <div className="text-[10px] text-slate-300 truncate max-w-sm">
                          {item.properties.recommended_action}
                        </div>
                      </div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-950 text-blue-300 border border-blue-800">
                        {item.properties.road_status === "SUBMERGED" ? "Flooded" : "View"}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Controls: Mode Toggle, Notifications, Status, User */}
          <div className="flex items-center space-x-2 sm:space-x-3 ml-3 flex-shrink-0">
            {/* Easy Mode vs Technical Data Mode Toggle */}
            <button
              onClick={() => {
                setIsAdvancedView(!isAdvancedView);
                showToast(
                  isAdvancedView
                    ? "Switched to Simple Mode (Plain English)"
                    : "Switched to Technical Satellite Telemetry Mode"
                );
              }}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded-xl text-xs font-semibold border transition ${
                isAdvancedView
                  ? "bg-purple-600 text-white border-purple-500 shadow-md"
                  : "bg-emerald-950/70 text-emerald-300 border-emerald-700/80 hover:bg-emerald-900/80"
              }`}
              title="Toggle between Easy mode and Technical satellite data"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{isAdvancedView ? "Technical Mode" : "Easy Mode"}</span>
            </button>

            {/* Notification Bell */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl bg-[#111A2C] border border-[#1E2A42] text-slate-300 hover:text-white transition"
                title="View recent alerts"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-full mt-2 w-80 bg-[#0F172A] border border-[#1E293B] rounded-2xl shadow-2xl p-3 z-50 space-y-2 animate-fadeIn">
                  <div className="flex justify-between items-center pb-2 border-b border-[#1E293B]">
                    <span className="font-bold text-xs text-white">Recent Safety Updates</span>
                    <span className="text-[10px] text-blue-400 font-semibold cursor-pointer" onClick={() => setNotificationsOpen(false)}>
                      Close
                    </span>
                  </div>
                  <div className="space-y-1.5 max-h-60 overflow-y-auto">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-2 rounded-xl bg-[#131C31] border border-[#1E293B] text-xs space-y-0.5">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-white text-[11px]">{n.title}</span>
                          <span className="text-[9px] text-slate-400 font-mono">{n.time}</span>
                        </div>
                        <p className="text-[10px] text-slate-300">{n.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Live Status Pill matching reference screenshot */}
            <div
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                isBlackout
                  ? "bg-amber-950/70 border-amber-600/70 text-amber-300 animate-pulse"
                  : "bg-[#0B1322] border-[#1C2740] text-emerald-400"
              }`}
            >
              <div
                className={`w-2 h-2 rounded-full ${
                  isBlackout ? "bg-amber-400 animate-ping" : "bg-emerald-400 animate-pulse"
                }`}
              />
              <span>{isBlackout ? "Offline Mesh" : "Live"}</span>
            </div>

            {/* Date & Time matching reference screenshot */}
            <div className="hidden lg:flex items-center space-x-1.5 text-xs text-slate-400 font-medium bg-[#0B1322] px-3 py-1.5 rounded-xl border border-[#1C2740]">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>Nov 21, 2026 • 14:32 IST</span>
            </div>

            {/* User Avatar */}
            <div
              className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center shadow-md shadow-blue-500/20 cursor-pointer"
              title="Disaster Response Team (H)"
            >
              H
            </div>
          </div>
        </header>

        {/* ERROR / RECONNECT BANNER */}
        {error && (
          <div className="bg-rose-950/95 border-b border-rose-800 px-4 py-2 flex items-center justify-between text-xs text-rose-200 z-10 flex-shrink-0">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              <span>{error}</span>
            </div>
            <button
              onClick={loadData}
              className="px-2.5 py-0.5 rounded bg-rose-900 hover:bg-rose-800 text-white text-[10px] font-bold"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* TOAST NOTIFICATION */}
        {toastMessage && (
          <div className="fixed bottom-4 right-4 z-50 px-3.5 py-2.5 bg-[#0F172A] border border-blue-500/60 rounded-xl shadow-2xl text-xs text-white flex items-center space-x-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* ============================================================ */}
        {/* ROUTED CONTENT AREA (Selected from 9 Navigation Options)    */}
        {/* ============================================================ */}
        <div className="p-4 sm:p-6 space-y-5">
          {/* Friendly Welcome Card for First-Time Users */}
          {!welcomeDismissed && activeNav === "dashboard" && (
            <div className="bg-gradient-to-r from-blue-950/70 via-[#0D1526] to-[#0D1526] border border-blue-500/30 rounded-2xl p-3.5 flex items-center justify-between text-xs text-slate-200 shadow-md">
              <div className="flex items-center space-x-2.5">
                <span className="text-base">👋</span>
                <p className="leading-snug">
                  <strong className="text-white">Welcome!</strong> TerraPulse monitors floods using Indian weather satellites and highlights safe roads to help people evacuate safely—even if mobile towers stop working.
                </p>
              </div>
              <button
                onClick={() => setWelcomeDismissed(true)}
                className="text-slate-400 hover:text-white px-2 py-1 text-xs"
                title="Dismiss"
              >
                ✕
              </button>
            </div>
          )}

          {activeNav === "alerts" ? (
            <DisasterAlertsView
              state={state}
              onDispatchCorridor={handleDispatch}
              onSelectFeature={(item) => {
                setSelectedItem(item);
                setActiveNav("dashboard");
              }}
              isAdvancedView={isAdvancedView}
            />
          ) : activeNav === "agriculture" ? (
            <AgricultureView
              state={state}
              onTriggerClaim={(blk) => showToast(`Automatic crop compensation claim queued for ${blk} farmers.`)}
              onDispatchCorridor={handleDispatch}
              isAdvancedView={isAdvancedView}
            />
          ) : activeNav === "hydrology" ? (
            <HydrologyView
              state={state}
              onDispatchCorridor={handleDispatch}
              isAdvancedView={isAdvancedView}
            />
          ) : activeNav === "analytics" ? (
            <AnalyticsView
              state={state}
              isAdvancedView={isAdvancedView}
            />
          ) : activeNav === "layers" ? (
            <MapLayersView
              activeLayers={activeLayers}
              onToggleLayer={toggleLayer}
              onRefresh={loadData}
              isAdvancedView={isAdvancedView}
            />
          ) : activeNav === "sos" ? (
            <EmergencySOSView
              state={state}
              onDispatchCorridor={handleDispatch}
              onSelectFeature={(item) => {
                setSelectedItem(item);
                setActiveNav("dashboard");
              }}
              isAdvancedView={isAdvancedView}
            />
          ) : activeNav === "reports" ? (
            <ReportsView
              state={state}
              isAdvancedView={isAdvancedView}
            />
          ) : activeNav === "settings" ? (
            <SettingsView
              state={state}
              onStateUpdate={setState}
              isAdvancedView={isAdvancedView}
              onToggleAdvancedView={() => setIsAdvancedView(!isAdvancedView)}
              onShowToast={showToast}
            />
          ) : (
            /* ============================================================ */
            /* 1. HERO MISSION-CONTROL DASHBOARD VIEW                       */
            /* ============================================================ */
            <div className="space-y-5">
              {/* 3. FOUR TOP KPI SUMMARY CARDS matching reference screenshot */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Active Disasters */}
                <div className="bg-[#0B1322] border border-[#18233C] rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center flex-shrink-0">
                      <Droplets className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">
                        Active Disasters
                      </span>
                      <strong className="text-2xl font-bold text-white tracking-tight">
                        {isRainBreached ? "4" : "3"}
                      </strong>
                    </div>
                  </div>
                  <Sparkline data={[2, 3, 2, 4, 3, 5, isRainBreached ? 6 : 3]} color="#3B82F6" width={95} height={38} />
                </div>

                {/* Card 2: Affected Area */}
                <div className="bg-[#0B1322] border border-[#18233C] rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center flex-shrink-0">
                      <Sprout className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">
                        Affected Area
                      </span>
                      <strong className="text-2xl font-bold text-white tracking-tight">
                        2.8K <span className="text-sm font-normal text-slate-400">km²</span>
                      </strong>
                    </div>
                  </div>
                  <Sparkline data={[1.2, 1.6, 2.0, 2.3, 2.5, 2.8]} color="#10B981" width={95} height={38} />
                </div>

                {/* Card 3: People at Risk */}
                <div className="bg-[#0B1322] border border-[#18233C] rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">
                        People at Risk
                      </span>
                      <strong className="text-2xl font-bold text-white tracking-tight">
                        125K+
                      </strong>
                    </div>
                  </div>
                  <Sparkline data={[45, 60, 78, 105, 118, 125]} color="#F59E0B" width={95} height={38} />
                </div>

                {/* Card 4: Alerts Today */}
                <div className="bg-[#0B1322] border border-[#18233C] rounded-2xl p-4 flex items-center justify-between shadow-lg">
                  <div className="flex items-center space-x-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center flex-shrink-0">
                      <Shield className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-xs text-slate-400 font-medium block">
                        Alerts Today
                      </span>
                      <strong className="text-2xl font-bold text-white tracking-tight">
                        {isRainBreached ? "9" : "7"}
                      </strong>
                    </div>
                  </div>
                  <Sparkline data={[2, 3, 4, 5, 5, 6, isRainBreached ? 9 : 7]} color="#A855F7" width={95} height={38} />
                </div>
              </div>

              {/* 4. CENTRAL MAP CANVAS + RIGHT ALERT INSPECTOR PANEL */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
                {/* Left / Center: Interactive Map Canvas (8 Cols) */}
                <div className="xl:col-span-8 h-[470px] bg-[#0A101D] border border-[#18233C] rounded-2xl overflow-hidden relative shadow-xl">
                  <CommandMap
                    features={state?.features}
                    sosPackets={state?.sos_packets}
                    dispatches={state?.dispatches}
                    activeLayers={activeLayers}
                    onToggleLayer={toggleLayer}
                    onSelectFeature={setSelectedItem}
                    selectedItem={selectedItem}
                    onDispatchCorridor={handleDispatch}
                    isAdvancedView={isAdvancedView}
                  />
                </div>

                {/* Right: Severity Alert & Action Card (4 Cols matching screenshot) */}
                <div className="xl:col-span-4 flex flex-col space-y-4">
                  {/* Top Alert Banner Card */}
                  <div className="bg-[#0B1322] border border-[#18233C] rounded-2xl p-4 space-y-3.5 shadow-xl relative overflow-hidden">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-red-500 font-bold text-xs">
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                        <span className="text-white text-xs font-semibold">High Severity Alert</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold flex items-center space-x-1 border border-red-500/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                        <span>Live</span>
                      </span>
                    </div>

                    <div className="flex items-start justify-between space-x-3">
                      <div className="space-y-1">
                        <h3 className="font-bold text-sm text-white leading-snug">
                          {selectedItem?.properties?.title ? selectedItem.properties.title : "Flood Risk in Bihar"}
                        </h3>
                        <p className="text-xs text-slate-400 leading-snug">
                          {selectedItem?.properties?.recommended_action
                            ? selectedItem.properties.recommended_action
                            : "Severe water accumulation detected near Darbhanga region."}
                        </p>
                      </div>

                      {/* Mini Satellite Thumbnail from reference */}
                      <div className="w-16 h-14 rounded-xl border border-[#1E293B] overflow-hidden flex-shrink-0 bg-[#101827]">
                        <img
                          src="/sat-alert-thumb.png"
                          alt="Satellite view"
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>

                    <button
                      onClick={() => handleDispatch(selectedItem)}
                      disabled={actionLoading}
                      className="w-full py-2.5 px-3 rounded-xl bg-[#121B2F] hover:bg-[#18243E] border border-[#20304E] text-xs font-semibold text-slate-200 hover:text-white flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
                    >
                      <span>View Details</span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>

                  {/* Bottom Inspector Card (Details, Impact, Resources) */}
                  <div className="bg-[#0B1322] border border-[#18233C] rounded-2xl p-4 flex-1 flex flex-col justify-between shadow-xl space-y-3.5">
                    <div className="space-y-3.5">
                      {/* Sub-tabs */}
                      <div className="flex space-x-1 bg-[#070C16] p-1 rounded-xl border border-[#141E33] text-xs font-semibold">
                        <button
                          onClick={() => setInspectorTab("details")}
                          className={`flex-1 py-1 rounded-lg transition text-xs ${
                            inspectorTab === "details"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Details
                        </button>
                        <button
                          onClick={() => setInspectorTab("impact")}
                          className={`flex-1 py-1 rounded-lg transition text-xs ${
                            inspectorTab === "impact"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Impact
                        </button>
                        <button
                          onClick={() => setInspectorTab("resources")}
                          className={`flex-1 py-1 rounded-lg transition text-xs ${
                            inspectorTab === "resources"
                              ? "bg-blue-600 text-white shadow-sm"
                              : "text-slate-400 hover:text-white"
                          }`}
                        >
                          Resources
                        </button>
                      </div>

                      {/* Tab 1: Details matching screenshot */}
                      {inspectorTab === "details" && (
                        <div className="space-y-2.5 text-xs">
                          <div className="flex items-center justify-between text-slate-400">
                            <span className="flex items-center space-x-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-500" />
                              <span>Location</span>
                            </span>
                            <span className="text-white font-medium">
                              {selectedItem?.properties?.title ? selectedItem.properties.title.split("-")[0] : "Darbhanga, Bihar"}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-slate-400">
                            <span className="flex items-center space-x-1.5">
                              <Calendar className="w-3.5 h-3.5 text-slate-500" />
                              <span>Detected On</span>
                            </span>
                            <span className="text-white font-medium">21 Nov 2026, 14:20</span>
                          </div>

                          <div className="flex items-center justify-between text-slate-400">
                            <span className="flex items-center space-x-1.5">
                              <Activity className="w-3.5 h-3.5 text-slate-500" />
                              <span>Severity</span>
                            </span>
                            <span className="text-red-500 font-bold">
                              High
                            </span>
                          </div>

                          {/* Recommended Actions Section matching screenshot */}
                          <div className="pt-2 border-t border-[#141E33] space-y-2">
                            <div className="text-xs font-bold text-white">
                              Recommended Actions
                            </div>
                            <ul className="space-y-1.5 text-xs text-slate-300">
                              <li className="flex items-center space-x-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                <span>Monitor rainfall updates</span>
                              </li>
                              <li className="flex items-center space-x-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                <span>Alert local authorities</span>
                              </li>
                              <li className="flex items-center space-x-2">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                                <span>Prepare evacuation if needed</span>
                              </li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {/* Tab 2: Impact */}
                      {inspectorTab === "impact" && (
                        <div className="space-y-2.5 text-xs">
                          <div className="flex justify-between text-slate-300">
                            <span>Rainfall Rate:</span>
                            <strong className="text-blue-400">
                              {isRainBreached ? "21.6 mm/hr (Spike)" : "4.8 mm/hr (Normal)"}
                            </strong>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Flooded Roads:</span>
                            <strong className="text-red-400">Sevan River Bridge Submerged</strong>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Safe High-Ground Bypass:</span>
                            <strong className="text-emerald-400">Highway 18 Hill Bypass</strong>
                          </div>
                        </div>
                      )}

                      {/* Tab 3: Resources */}
                      {inspectorTab === "resources" && (
                        <div className="space-y-2.5 text-xs">
                          <div className="flex justify-between text-slate-300">
                            <span>Relief Center:</span>
                            <strong className="text-emerald-400">VIT College Relief Shelter</strong>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Capacity:</span>
                            <strong className="text-white">850 People (Beds & Food)</strong>
                          </div>
                          <div className="flex justify-between text-slate-300">
                            <span>Off-Grid Radio Mesh:</span>
                            <strong className="text-amber-400">LoRa 865–867 MHz Active</strong>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Quick Simulation Buttons */}
                    <div className="pt-2 border-t border-[#141E33] grid grid-cols-2 gap-2">
                      <button
                        onClick={handleRainSpike}
                        disabled={actionLoading}
                        className="py-2 px-2.5 rounded-xl bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 text-xs font-semibold flex items-center justify-center space-x-1.5 transition disabled:opacity-50"
                        title="Simulate sudden heavy rainfall"
                      >
                        <Zap className="w-3.5 h-3.5 text-blue-400" />
                        <span>Simulate Storm</span>
                      </button>

                      <button
                        onClick={() => handleModeChange(isBlackout ? "NORMAL" : "CELL_BLACKOUT_MESH_ACTIVE")}
                        disabled={actionLoading}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition disabled:opacity-50 ${
                          isBlackout
                            ? "bg-emerald-950/80 text-emerald-300 border-emerald-600"
                            : "bg-amber-950/40 text-amber-300 border-amber-600/60"
                        }`}
                        title="Toggle cellular tower status"
                      >
                        <WifiOff className="w-3.5 h-3.5" />
                        <span>{isBlackout ? "Network Live" : "Test Blackout"}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* 5. BOTTOM ROW (3 Cards matching reference screenshot) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Card 1: Recent Activity */}
                <div className="bg-[#0B1322] border border-[#18233C] rounded-2xl p-4 space-y-3.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Activity className="w-4 h-4 text-blue-400" />
                      <h3 className="font-bold text-xs text-white">Recent Activity</h3>
                    </div>
                    <button
                      onClick={() => setActiveNav("alerts")}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      View All →
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                        <span className="text-slate-400 text-xs font-mono">14:20</span>
                        <span className="text-slate-200 text-xs truncate max-w-[170px]">
                          New flood alert detected in Darbhanga, Bihar
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[10px] font-bold">
                        High
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                        <span className="text-slate-400 text-xs font-mono">13:50</span>
                        <span className="text-slate-200 text-xs truncate max-w-[170px]">
                          Updated weather forecast for Bihar
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 text-[10px] font-bold">
                        Info
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
                        <span className="text-slate-400 text-xs font-mono">12:30</span>
                        <span className="text-slate-200 text-xs truncate max-w-[170px]">
                          Satellite data processed successfully
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                        Success
                      </span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Data Layers with iOS slider toggles */}
                <div className="bg-[#0B1322] border border-[#18233C] rounded-2xl p-4 space-y-3.5 shadow-lg">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <h3 className="font-bold text-xs text-white">Data Layers</h3>
                    </div>
                    <button
                      onClick={() => setActiveNav("layers")}
                      className="text-xs text-blue-400 hover:text-blue-300 font-semibold"
                    >
                      Manage →
                    </button>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    {/* Row 1: Flood Risk Layer */}
                    <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#11192C] transition">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-red-950/70 border border-red-800/80 flex items-center justify-center">
                          <div className="w-3.5 h-3.5 rounded bg-red-500/80" />
                        </div>
                        <span className="text-xs font-medium text-slate-200">
                          Flood Risk Layer
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLayer("bhoonidhi_flood")}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                          activeLayers.bhoonidhi_flood ? "bg-blue-600 justify-end" : "bg-[#1E293B] justify-start"
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                      </button>
                    </div>

                    {/* Row 2: Rainfall Intensity */}
                    <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#11192C] transition">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-blue-950/70 border border-blue-800/80 flex items-center justify-center">
                          <Droplets className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <span className="text-xs font-medium text-slate-200">
                          Rainfall Intensity
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLayer("mosdac_rain")}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                          activeLayers.mosdac_rain ? "bg-blue-600 justify-end" : "bg-[#1E293B] justify-start"
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                      </button>
                    </div>

                    {/* Row 3: Land Use */}
                    <div className="flex items-center justify-between p-1.5 rounded-xl hover:bg-[#11192C] transition">
                      <div className="flex items-center space-x-2.5">
                        <div className="w-7 h-7 rounded-lg bg-emerald-950/70 border border-emerald-800/80 flex items-center justify-center">
                          <Sprout className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <span className="text-xs font-medium text-slate-200">
                          Land Use
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLayer("bhuvan_assets")}
                        className={`w-9 h-5 flex items-center rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
                          activeLayers.bhuvan_assets ? "bg-blue-600 justify-end" : "bg-[#1E293B] justify-start"
                        }`}
                      >
                        <span className="w-4 h-4 rounded-full bg-white shadow-md transform transition-transform" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Card 3: Banner Card matching reference screenshot */}
                <div className="bg-[#0B1322] border border-[#18233C] rounded-2xl p-4 flex items-center justify-between shadow-lg relative overflow-hidden group">
                  <div className="space-y-1.5 max-w-[62%] z-10">
                    <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                      <Sprout className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="font-bold text-xs text-white leading-tight">
                      Together for a Disaster Resilient India
                    </h4>
                    <p className="text-[10px] text-slate-400 leading-tight">
                      Real-time insights. Greater preparedness.
                    </p>
                    <button
                      onClick={() => showToast("ISRO Disaster Management Support Programme active.")}
                      className="mt-1 px-3 py-1 rounded-lg bg-[#142036] hover:bg-[#1B2B48] text-[10px] font-semibold text-white border border-[#233550] flex items-center space-x-1 transition"
                    >
                      <span>Learn More</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                    </button>
                  </div>

                  <div className="w-28 h-20 rounded-xl overflow-hidden border border-[#1E293B] flex-shrink-0 bg-[#070B14]">
                    <img
                      src="/flooded-village.png"
                      alt="Disaster Resilient India"
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
