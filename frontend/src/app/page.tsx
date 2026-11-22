"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3, Bell, ChevronDown, CloudRain, CloudSun, FileText, Globe2, Home, Landmark, Layers3, MapPin, Menu,
  Radio, RotateCcw, Send, Settings2, ShieldCheck, Sprout, WifiOff, X,
} from "lucide-react";
import Brand from "@/components/Brand";
import CommandMap, { type MapSelection, type MapTarget } from "@/components/CommandMap";
import { AlertCard, KpiCards, LayerCard, MeshCard, RecentActivity, type ActivityEntry } from "@/components/DashboardCards";
import { Analytics, DisasterAlerts, Reports, Settings } from "@/components/OperationsViews";
import PlaceSearch, { type SearchChoice } from "@/components/PlaceSearch";
import { briefing, defaultFeature, timeOf, type FocusItem } from "@/lib/briefing";
import { DEFAULT_LAYERS, LAYERS, type LayerKey } from "@/lib/layers";
import { distanceKm, getRegion, INDIA, nearestRegion, REGIONS, type Point, type Region } from "@/lib/regions";
import {
  compileLocalState, featurePoint, featureRegion, fetchRegions, fetchState, pushEvacuationDispatch, resetScenario,
  scopeState, subscribeToTelemetry, switchOperationalMode, syncPortalData, triggerRainfallSpike, type TerraPulseStateResponse,
} from "@/lib/terrapulseClient";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: Home },
  { id: "alerts", label: "Disaster Alerts", icon: Bell },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
  { id: "layers", label: "Layers", icon: Layers3 },
  { id: "reports", label: "Reports", icon: FileText },
] as const;

export type NavItem = typeof NAV[number]["id"] | "settings";
const HEADINGS: Record<NavItem, [string, string]> = {
  dashboard: ["India Disaster Monitor", "Track heavy rain, flooded areas, safe routes and calls for help across India."],
  alerts: ["Disaster Alerts", "Review weather warnings, road closures and requests for help."],
  analytics: ["Crop & Rain Stress", "Compare rainfall, wind, soil moisture and crop conditions by place."],
  layers: ["Map & Data Layers", "Choose what appears on the map."],
  reports: ["Reservoirs, Water & Local Safety", "Review water storage, public facilities and local planning areas."],
  settings: ["Settings", "Check where the data came from and manage the connectivity exercise."],
};

function targetFor(region: Region): MapTarget {
  return { center: region.center, zoom: region.zoom, bbox: region.bbox, label: region.name };
}

function Clock() {
  const [time, setTime] = useState<string>();
  useEffect(() => {
    const tick = () => setTime(new Date().toISOString());
    tick();
    const interval = setInterval(tick, 10000);
    return () => clearInterval(interval);
  }, []);
  return <div className="tp-clock" aria-label="India and UTC clocks">
    <span><b>{time ? timeOf(time) : "—"}</b> IST</span>
    <span><b>{time ? timeOf(time, "UTC") : "—"}</b> UTC</span>
  </div>;
}

function activity(title: string, detail: string, tone: ActivityEntry["tone"]): ActivityEntry {
  return { title, detail, tone, time: new Date().toISOString() };
}

export default function Dashboard() {
  const [snapshot, setSnapshot] = useState(compileLocalState);
  const [scoped, setScoped] = useState<TerraPulseStateResponse>();
  const [regions, setRegions] = useState(REGIONS);
  const [region, setRegion] = useState(INDIA);
  const [target, setTarget] = useState(() => targetFor(INDIA));
  const [selection, setSelection] = useState<FocusItem | null>(null);
  const [nav, setNav] = useState<NavItem>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [layers, setLayers] = useState(DEFAULT_LAYERS);
  const [working, setWorking] = useState<string>();
  const locking = useRef(false);
  const [notice, setNotice] = useState<{ title: string; detail: string; error?: boolean }>();
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [browserOffline, setBrowserOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [series, setSeries] = useState<{ region: string; data: number[][] }>({ region: INDIA.id, data: [] });

  const state = scoped?.last_updated === snapshot.last_updated && scoped.features.metadata.region_id === region.id
    ? scoped : scopeState(snapshot, { region: region.id });
  const blackout = snapshot.mode === "CELL_BLACKOUT_MESH_ACTIVE";
  const mapOffline = browserOffline || blackout;
  const apiConnected = snapshot.connection === "api" && !browserOffline;
  const provenance = Object.values(state.features.metadata.portal_provenance ?? {});
  const sample = !provenance.some((item) => item.source_type === "live_portal");
  const dataLabel = sample ? "Exercise data" : provenance.every((item) => item.source_type === "live_portal") ? "Live portal data" : "Mixed portal data";
  const brief = briefing(selection, region, state);
  const resources = useMemo(() => snapshot.features.features.filter((feature) => {
    return ["SHELTER", "HOSPITAL", "SCHOOL", "GRAM_PANCHAYAT"].includes(feature.properties.asset_type ?? "")
      && distanceKm(featurePoint(feature), brief.center) <= 95;
  }).sort((a, b) => distanceKm(featurePoint(a), brief.center) - distanceKm(featurePoint(b), brief.center)).slice(0, 4),
  [snapshot.features.features, brief.center[0], brief.center[1]]);
  const alertCount = state.kpis.active_alerts + state.kpis.active_sos_count;

  function log(entry: ActivityEntry) {
    setEntries((old) => {
      if (old[0]?.title === entry.title && Math.abs(Date.parse(old[0].time) - Date.parse(entry.time)) < 1800) return old;
      return [entry, ...old].slice(0, 10);
    });
  }

  useEffect(() => {
    let alive = true;
    const refresh = () => {
      void fetchState().then((value) => {
        if (!alive) return;
        setSnapshot(value);
        setBrowserOffline(!navigator.onLine);
        setLoading(false);
      });
    };
    setBrowserOffline(!navigator.onLine);
    refresh();
    void fetchRegions().then((result) => { if (alive) setRegions(result); });
    const cancel = subscribeToTelemetry((event) => {
      if (event.event === "offline") setBrowserOffline(true);
      if (event.event === "sos_received") log(activity("Help request received", "A field responder shared a location and request for assistance.", "warm"));
      if (event.event === "dispatch_pushed") log(activity("Route shared", event.data?.destination ?? "A safe route is available to field responders.", "mesh"));
      if (event.event !== "offline") refresh();
    });
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#global-search-input")?.focus();
      }
    };
    window.addEventListener("keydown", shortcut);
    return () => { alive = false; cancel(); window.removeEventListener("keydown", shortcut); };
  }, []);

  useEffect(() => {
    if (region.id === INDIA.id || !snapshot.features.metadata.truncated || snapshot.connection !== "api") return;
    let current = true;
    void fetchState({ region: region.id }).then((data) => { if (current) setScoped(data); });
    return () => { current = false; };
  }, [snapshot, region.id]);

  const heavy = state.kpis.heavy_rain_alerts;
  const water = state.kpis.flooded_area_km2;
  const people = state.kpis.people_at_risk;
  const alerts = state.kpis.active_alerts;
  useEffect(() => {
    const values = [heavy, water, people, alerts];
    setSeries((old) => {
      const existing = old.region === region.id ? old.data : [];
      return {
        region: region.id,
        data: values.map((value, i) => existing[i]?.at(-1) === value
          ? existing[i] : [...(existing[i] ?? []), value].slice(-9)),
      };
    });
  }, [region.id, heavy, water, people, alerts]);

  const history = series.region === region.id ? series.data : [];
  const lead = defaultFeature(state);
  const baseline: ActivityEntry[] = [
    ...(lead ? [{ title: lead.properties.layer === "bhoonidhi_flood" ? "Water extent available" : "Rainfall readings available",
      detail: lead.properties.place_name ?? featureRegion(lead).short_name,
      time: lead.properties.observed_at ?? snapshot.last_updated, tone: "flood" as const }] : []),
    ...(state.kpis.open_corridors_count ? [{ title: "Higher-ground routes available", detail: `${state.kpis.open_corridors_count} routes on the map`,
      time: snapshot.last_updated, tone: "warm" as const }] : []),
    { title: "Rescue mesh exercise ready", detail: "Field responder can save requests offline.", time: snapshot.last_updated, tone: "mesh" },
  ];

  function chooseRegion(next: Region) {
    setRegion(next);
    setTarget(targetFor(next));
    setSelection(null);
  }

  function focus(item: FocusItem) {
    const point: Point = item.kind === "feature" ? featurePoint(item.feature)
      : item.kind === "place" ? item.center : [item.request.position.lng, item.request.position.lat];
    const area = item.kind === "feature" ? featureRegion(item.feature)
      : item.kind === "place" ? getRegion(item.regionId) : nearestRegion(point);
    const name = item.kind === "feature" ? item.feature.properties.title : item.kind === "place" ? item.name : "Help request";
    setRegion(area);
    setTarget({ center: point, zoom: item.kind === "place" ? 9 : 10, label: name });
    setSelection(item);
    setNav("dashboard");
  }

  function chooseSearch(choice: SearchChoice) {
    if (choice.item) focus(choice.item);
    else { chooseRegion(choice.region); setNav("dashboard"); }
  }

  function selectMap(item: MapSelection) {
    focus("sos_id" in item ? { kind: "help", request: item } : { kind: "feature", feature: item });
  }

  async function run(label: string, action: () => Promise<void>) {
    if (locking.current) return;
    locking.current = true;
    setWorking(label);
    setNotice(undefined);
    try {
      await action();
    } catch (error) {
      setNotice({ title: "Couldn’t complete that action", detail: error instanceof Error && error.name !== "AbortError"
        ? error.message : "The connection timed out. Please try again.", error: true });
    } finally {
      locking.current = false;
      setWorking(undefined);
    }
  }

  const rain = (area = region) => run("Simulating heavy rain…", async () => {
    const next = area.id === INDIA.id ? getRegion("central-india") : area;
    const threshold = snapshot.features.metadata.rainfall_threshold_mm_hr ?? 15;
    const updated = await triggerRainfallSpike(4.5, Math.min(250, Math.max(34, threshold + 10)), next.id);
    setSnapshot(updated);
    chooseRegion(next);
    setNav("dashboard");
    const detail = `${next.short_name} is affected. Check low crossings and the marked higher-ground routes.`;
    setNotice({ title: "Heavy rain simulated", detail });
    log(activity("Heavy rain simulated", detail, "rain"));
  });

  const changeMode = () => run(blackout ? "Restoring connection…" : "Simulating blackout…", async () => {
    const update = await switchOperationalMode(blackout ? "BACKHAUL_SYNC" : "CELL_BLACKOUT_MESH_ACTIVE");
    setSnapshot({ ...update });
    const title = blackout ? "Connection restored" : "Network blackout simulated";
    const detail = blackout ? "Field responders can sync their queued exercise requests." : "Field responders can save help requests while the mobile network is down.";
    setNotice({ title, detail });
    log(activity(title, detail, "mesh"));
  });

  const sendRoute = (area = brief.region) => run("Sending safe route…", async () => {
    const corridorId = selection?.kind === "feature" && selection.feature.properties.road_status === "CORRIDOR" ? selection.feature.id : undefined;
    const dispatch = await pushEvacuationDispatch({ region: area.id, corridor_id: corridorId });
    const title = dispatch.saved_locally ? "Route saved on this device" : "Safe route shared";
    const detail = dispatch.saved_locally ? `${dispatch.safe_asset.name} is available in the local map.`
      : `Field responders can open the route to ${dispatch.safe_asset.name}.`;
    setNotice({ title, detail });
    const local = compileLocalState();
    setSnapshot({ ...local, dispatches: [...local.dispatches] });
    log(activity(title, detail, "mesh"));
  });

  const reset = () => run("Resetting exercise…", async () => {
    setSnapshot(await resetScenario());
    chooseRegion(INDIA);
    setEntries([]);
    setSeries({ region: INDIA.id, data: [] });
    setNotice({ title: "Exercise reset", detail: "The national map and original exercise readings are ready." });
  });

  const sync = () => run("Refreshing portal data…", async () => {
    setSnapshot(await syncPortalData());
    setSelection(null);
    setNotice({ title: "Data refreshed", detail: "The map shows the latest available feed or sample from each portal." });
    log(activity("Portal data refreshed", "Check Settings for the source of each update.", "rain"));
  });

  const toggleLayer = (id: LayerKey) => setLayers((old) => ({ ...old, [id]: !old[id] }));
  const showNav = (active: NavItem) => { setNav(active); setMobileNav(false); };
  const statusText = blackout ? "Offline Mesh" : apiConnected ? (snapshot.mode === "BACKHAUL_SYNC" ? "Backhaul Sync" : "Live") : loading ? "Connecting" : "Offline Map";

  return (
    <div className="tp-app">
      <a className="tp-skip" href="#main-content">Skip to main content</a>
      {mobileNav && <button className="tp-mobile-scrim" type="button" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <aside id="main-navigation" className={`tp-sidebar ${mobileNav ? "tp-sidebar-open" : ""}`}>
        <button className="tp-brand-button" type="button" onClick={() => showNav("dashboard")} aria-label="TerraPulse dashboard"><Brand /></button>
        <nav aria-label="Main navigation">
          {NAV.map(({ id, label, icon: Icon }) => <button type="button" key={id} onClick={() => showNav(id)}
            aria-current={nav === id ? "page" : undefined}><Icon size={18} /><span>{label}</span>
            {id === "alerts" && alertCount > 0 && <small className="tp-nav-count">{alertCount}</small>}
          </button>)}
          <a href={`/field?region=${region.id}`}><Radio size={18} /><span>Field Responder</span></a>
          <a href="/weather"><CloudSun size={18} /><span>India Weather</span></a>
          <a href={`/farm?region=${region.id}`}><Sprout size={18} /><span>Farm Planner</span></a>
          <a href="/government"><Landmark size={18} /><span>Government Portal</span></a>
          <button type="button" onClick={() => showNav("settings")} aria-current={nav === "settings" ? "page" : undefined}>
            <Settings2 size={18} /><span>Settings</span>
          </button>
        </nav>
        <div className="tp-sidebar-note">
          <ShieldCheck size={19} /><strong>Building a Safer,<br />Smarter India</strong>
          <small>Powered by ISRO data sources</small><small>TerraPulse v1.0</small>
        </div>
      </aside>

      <main className="tp-main" id="main-content">
        <header className="tp-topbar">
          <button type="button" className="tp-icon-button tp-mobile-toggle" aria-label="Open navigation" aria-expanded={mobileNav} aria-controls="main-navigation"
            onClick={() => setMobileNav(!mobileNav)}><Menu size={20} /></button>
          <span className="tp-mobile-brand" aria-hidden="true">TerraPulse</span>
          <PlaceSearch regions={regions} features={snapshot.features.features} offline={mapOffline} onChoose={chooseSearch} />
          <div className="tp-top-spacer" />
          <div className="tp-region-select"><Globe2 size={16} aria-hidden />
            <select aria-label="Region / Basin" value={region.id}
              onChange={(event) => chooseRegion(regions.find((item) => item.id === event.target.value) ?? getRegion(event.target.value))}>
              {regions.map((area) => <option key={area.id} value={area.id}>{area.id === INDIA.id ? area.name : `${area.short_name} · ${area.basin}`}</option>)}
            </select><ChevronDown size={14} aria-hidden />
          </div>
          <span className={`tp-live ${blackout || !apiConnected ? "tp-live-offline" : ""}`} role="status"><i />{statusText}</span>
          <Clock />
        </header>

        <div className="tp-main-content">
          <div className={nav === "dashboard" ? "tp-command-intro" : undefined}>
            <div className="tp-page-heading">
              <div className="tp-context"><MapPin size={14} /> {region.id === INDIA.id ? "All India" : region.basin}<span />{dataLabel}</div>
              <h1>{HEADINGS[nav][0]}</h1>
              <p>{HEADINGS[nav][1]}</p>
            </div>
            {(nav === "dashboard" || nav === "settings") && (
              <div className="tp-scenario-bar" role="group" aria-label="Exercise controls">
                <span className="tp-scenario-label">Demo controls</span>
                <button type="button" className="tp-button tp-scenario-rain" onClick={() => void rain()} disabled={!!working}><CloudRain size={16} />
                  Simulate Heavy Rain <span>&gt;{snapshot.features.metadata.rainfall_threshold_mm_hr ?? 15} mm/hr</span></button>
                <button type="button" className="tp-button" onClick={() => void changeMode()} disabled={!!working}><WifiOff size={15} />
                  {blackout ? "Restore Connection" : "Simulate Network Blackout"}</button>
                <button type="button" className="tp-button" onClick={() => void sendRoute()} disabled={!!working}><Send size={15} /> Send Safe Route</button>
                <button type="button" className="tp-button tp-reset" onClick={() => void reset()} disabled={!!working}><RotateCcw size={15} /> Reset</button>
                {working && <span className="tp-working" role="status">{working}</span>}
              </div>
            )}
          </div>
          {!apiConnected && !loading && !blackout && (
            <div className="tp-cache-notice" role="status"><WifiOff size={16} /> Showing {snapshot.connection === "cache" ? "the last saved map" : "the built-in exercise map"}.</div>
          )}

          {nav === "dashboard" && <>
            <KpiCards state={state} history={history} sample={sample && region.id === INDIA.id} />
            <div className="tp-map-layout">
              <section className="tp-card tp-map-card" aria-label="Situational map">
                <div className="tp-card-heading tp-map-heading"><span><Globe2 size={18} /> Situational Map</span>
                  <small>{region.name}</small>
                </div>
                <CommandMap target={target} features={state.features.features} sosPackets={state.sos_packets}
                  dispatches={state.dispatches} activeLayers={layers} offline={mapOffline} allowTilt
                  onRegion={chooseRegion} onSelect={selectMap} onLayers={() => showNav("layers")}
                  onSync={() => void sync()}
                  onPoint={(center) => setSelection({ kind: "place", name: "Selected map location", center, regionId: nearestRegion(center).id })} />
                <div className="tp-map-legend" aria-label="Map legend">
                  {LAYERS.map(({ id, color, name }) => <span key={id} title={name}><i data-layer={id} style={{ color: id === "sos_mesh" ? "#ff6868" : color }} />{
                    ({ mosdac_rain: "Heavy rain", bhoonidhi_flood: "Flood water", vedas_roads: "Closed road",
                      vedas_corridors: "Safe route", bhuvan_assets: "Relief point", sos_mesh: "SOS request" })[id]
                  }</span>)}
                </div>
              </section>
              <AlertCard key={`${brief.title}-${brief.place}`} brief={brief} resources={resources} disabled={!!working}
                onResource={(feature) => focus({ kind: "feature", feature })}
                onDispatch={() => void sendRoute(brief.region)} onRain={() => void rain(brief.region)} />
            </div>
            <div className="tp-bottom-grid">
              <RecentActivity entries={[...entries, ...baseline]} region={region} />
              <LayerCard active={layers} onToggle={toggleLayer} />
              <MeshCard state={state} region={region} offline={blackout} />
            </div>
          </>}
          {nav === "alerts" && <DisasterAlerts state={state} onSelect={focus} />}
          {nav === "analytics" && <Analytics state={state} />}
          {nav === "layers" && <div className="tp-secondary-grid tp-layer-view">
            <LayerCard active={layers} onToggle={toggleLayer} all />
            <section className="tp-card tp-map-card"><div className="tp-card-heading"><span><Globe2 size={17} /> Map Preview</span></div>
              <CommandMap target={target} features={state.features.features} activeLayers={layers} sosPackets={state.sos_packets}
                offline={mapOffline} onSelect={selectMap} onRegion={chooseRegion} />
            </section>
          </div>}
          {nav === "reports" && <Reports state={state} region={region} />}
          {nav === "settings" && <Settings state={snapshot} onSync={() => void sync()} onMode={() => void changeMode()} onReset={() => void reset()} busy={!!working} />}
        </div>
      </main>
      {notice && <div className={`tp-notice ${notice.error ? "tp-notice-error" : ""}`} role={notice.error ? "alert" : "status"}>
        <div><strong>{notice.title}</strong><p>{notice.detail}</p></div>
        <button type="button" className="tp-icon-button" aria-label="Dismiss update" onClick={() => setNotice(undefined)}><X size={17} /></button>
      </div>}
    </div>
  );
}
