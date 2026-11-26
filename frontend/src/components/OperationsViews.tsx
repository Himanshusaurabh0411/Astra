"use client";

import { useState } from "react";
import { Bell, CloudRain, Droplets, FileText, HeartPulse, Key, MapPin, Radio, RefreshCw, Satellite, ShieldCheck, Sprout, TriangleAlert } from "lucide-react";
import { isAlert, formatNumber, friendlyNeed, timeOf, type FocusItem } from "@/lib/briefing";
import { type Region } from "@/lib/regions";
import { LABELS, SOURCE_NAMES } from "@/lib/layers";
import { type TerraPulseStateResponse } from "@/lib/terrapulseClient";
import { loginBhoonidhi, refreshBhoonidhiToken, searchBhoonidhiImagery, type BhoonidhiAuthResponse, type BhoonidhiStacResponse } from "@/lib/bhoonidhiAuth";

export function DisasterAlerts({ state, onSelect }: {
  state: TerraPulseStateResponse; onSelect: (item: FocusItem) => void;
}) {
  const features = state.features.features.filter((feature) => isAlert(feature, state.features.metadata.rainfall_threshold_mm_hr));
  return <section className="tp-card tp-secondary-panel" aria-label="Disaster alerts">
    <div className="tp-card-heading"><span><Bell size={18} /> Map Alerts</span><small>{features.length} alerts</small></div>
    <div className="tp-list">
      {features.map((feature, index) => <button key={feature.id ?? index} type="button"
        onClick={() => onSelect({ kind: "feature", feature })}>
        <span className="tp-list-icon"><TriangleAlert size={18} /></span>
        <span><strong>{feature.properties.title}</strong><small>{
          feature.properties.road_status === "SUBMERGED" ? "Road closed"
            : feature.properties.layer === "mosdac_rain" ? "Heavy rain watch" : "Flooded area"
        } · {feature.properties.place_name ?? state.features.metadata.basin_name}</small></span>
        <span className="tp-list-tail">View on map</span>
      </button>)}
      {!features.length && <p className="tp-empty">There are no active weather or road alerts in this area.</p>}
    </div>
    <div className="tp-card-heading tp-list-heading"><span><HeartPulse size={18} /> Help Requests</span><small>{state.sos_packets.length} active</small></div>
    <div className="tp-list">
      {state.sos_packets.map((request) => <button type="button" key={request.sos_id}
        onClick={() => onSelect({ kind: "help", request })}>
        <span className="tp-list-icon"><Radio size={18} /></span><span><strong>{friendlyNeed(request.triage.severity)} help request</strong>
          <small>{formatNumber(request.triage.headcount)} people · {request.triage.needs.map(friendlyNeed).join(", ")}</small>
        </span><span className="tp-list-tail">View on map</span>
      </button>)}
      {!state.sos_packets.length && <p className="tp-empty">There are no help requests in this area.</p>}
    </div>
  </section>;
}

export function Analytics({ state }: { state: TerraPulseStateResponse }) {
  const features = state.features.features;
  const rains = features.filter((f) => f.properties.layer === "mosdac_rain")
    .sort((a, b) => (b.properties.rainfall_mm_hr ?? 0) - (a.properties.rainfall_mm_hr ?? 0));
  const crops = features.filter((f) => f.properties.crop_stress_pct !== undefined)
    .sort((a, b) => (b.properties.crop_stress_pct ?? 0) - (a.properties.crop_stress_pct ?? 0));
  const threshold = state.features.metadata.rainfall_threshold_mm_hr ?? 15;
  return <div className="tp-secondary-grid">
    <section className="tp-card tp-secondary-panel">
      <div className="tp-card-heading"><span><CloudRain size={18} /> Rain by Place</span><small>Heavy above {threshold} mm/hr</small></div>
      <div className="tp-table-wrap"><table className="tp-table">
        <thead><tr><th>Place</th><th>Rain</th><th>Wind</th><th>Soil moisture</th></tr></thead>
        <tbody>{rains.map((feature, index) => {
          const p = feature.properties;
          return <tr key={feature.id ?? index}>
            <th scope="row">{p.place_name ?? p.title}</th>
            <td><span className={(p.rainfall_mm_hr ?? 0) > threshold ? "tp-warn-text" : undefined}>{formatNumber(p.rainfall_mm_hr ?? 0, 1)} mm/hr</span></td>
            <td>{p.wind_km_hr === undefined ? "—" : `${formatNumber(p.wind_km_hr)} km/h`}</td>
            <td>{p.soil_moisture_pct === undefined ? "—" : `${formatNumber(p.soil_moisture_pct)}%`}</td>
          </tr>;
        })}</tbody>
      </table></div>
      {!rains.length && <p className="tp-empty">Rain readings are unavailable for this area.</p>}
    </section>
    <section className="tp-card tp-secondary-panel">
      <div className="tp-card-heading"><span><Sprout size={18} /> Crop Stress</span></div>
      <p className="tp-view-intro">Higher percentages show more stress from wet or dry conditions.</p>
      <div className="tp-bars">
        {crops.map((f, index) => <div className="tp-bar" key={f.id ?? index}>
          <div><strong>{f.properties.place_name ?? f.properties.title}</strong><span>{formatNumber(f.properties.crop_stress_pct ?? 0)}%</span></div>
          <progress max="100" value={f.properties.crop_stress_pct ?? 0} aria-label={f.properties.title} />
          <small>Soil moisture {f.properties.soil_moisture_pct ?? "—"}{f.properties.soil_moisture_pct !== undefined && "%"}</small>
        </div>)}
        {!crops.length && <p className="tp-empty">Crop readings are unavailable for this area.</p>}
      </div>
    </section>
  </div>;
}

export function Reports({ state, region }: { state: TerraPulseStateResponse; region: Region }) {
  const features = state.features.features;
  const reservoirs = features.filter((f) => f.properties.asset_type === "RESERVOIR" && f.properties.layer === "bhuvan_assets");
  const amenities = features.filter((f) => f.properties.asset_type && ["HOSPITAL", "SCHOOL", "GRAM_PANCHAYAT", "SHELTER"].includes(f.properties.asset_type));
  const land = features.filter((f) => f.properties.boundary_type || f.properties.land_use && f.properties.asset_type === "NONE");
  return <div className="tp-secondary-grid">
    <section className="tp-card tp-secondary-panel">
      <div className="tp-card-heading"><span><Droplets size={18} /> Reservoirs &amp; Water</span></div>
      <div className="tp-bars">
        {reservoirs.map((f, index) => <div className="tp-bar" key={f.id ?? index}>
          <div><strong>{f.properties.title}</strong><span>{f.properties.storage_pct === undefined ? "Level unavailable" : `${formatNumber(f.properties.storage_pct)}%`}</span></div>
          {f.properties.storage_pct !== undefined && <progress max="100" value={f.properties.storage_pct} aria-label={`${f.properties.title} storage`} />}
          {f.properties.capacity_mcm && <small>{formatNumber(f.properties.capacity_mcm)} million m³ capacity</small>}
        </div>)}
        {!reservoirs.length && <p className="tp-empty">There are no mapped reservoirs in this area.</p>}
      </div>
    </section>
    <section className="tp-card tp-secondary-panel">
      <div className="tp-card-heading"><span><FileText size={18} /> Local Safety Report</span>
        <button type="button" className="tp-button" onClick={() => window.print()}>Print report</button>
      </div>
      <p className="tp-view-intro">{region.name} · {state.kpis.submerged_roads_count} roads to avoid · {state.kpis.open_corridors_count} higher-ground routes</p>
      <div className="tp-table-wrap"><table className="tp-table">
        <thead><tr><th>Location</th><th>Type</th></tr></thead>
        <tbody>{amenities.map((f, i) => <tr key={f.id ?? i}><th scope="row">{f.properties.title}</th><td>{LABELS[f.properties.asset_type ?? "NONE"]}</td></tr>)}</tbody>
      </table></div>
      {land.length > 0 && <div className="tp-land-audit"><h3>Land use and local boundaries</h3>
        <ul>{land.map((f, i) => <li key={f.id ?? i}><MapPin size={15} /><span>{f.properties.title}<small>{f.properties.land_use ?? f.properties.boundary_type}</small></span></li>)}</ul>
      </div>}
    </section>
  </div>;
}

export function Settings({ state, onSync, onMode, onReset, busy }: {
  state: TerraPulseStateResponse; onSync: () => void; onMode: () => void; onReset: () => void; busy: boolean;
}) {
  const sources = state.features.metadata.portal_provenance;
  const [bhoonidhiAuth, setBhoonidhiAuth] = useState<BhoonidhiAuthResponse | null>(null);
  const [bhoonidhiStac, setBhoonidhiStac] = useState<BhoonidhiStacResponse | null>(null);
  const [authBusy, setAuthBusy] = useState(false);
  const [authMsg, setAuthMsg] = useState("");

  const handleAuthenticate = async () => {
    setAuthBusy(true);
    setAuthMsg("Contacting ISRO Bhoonidhi Token Gateway…");
    try {
      const auth = await loginBhoonidhi("1104f7577ce2f11b68c3f0ce0654d901e135134c");
      setBhoonidhiAuth(auth);
      setAuthMsg(`Authenticated: Bearer token generated for ${auth.user_id}`);
    } catch (e: any) {
      setAuthMsg(`Auth error: ${e.message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleRefresh = async () => {
    if (!bhoonidhiAuth?.refresh_token) {
      setAuthMsg("Authenticate first to obtain a refresh token.");
      return;
    }
    setAuthBusy(true);
    setAuthMsg("Rotating session with refresh token…");
    try {
      const refreshed = await refreshBhoonidhiToken(bhoonidhiAuth.refresh_token);
      setBhoonidhiAuth((prev) => prev ? {
        ...prev,
        access_token: refreshed.access_token,
        refresh_token: refreshed.refresh_token,
        issued_at: refreshed.issued_at,
        expires_at: refreshed.expires_at,
        status: "refreshed",
      } : null);
      setAuthMsg("Token rotated successfully (new 3600s TTL).");
    } catch (e: any) {
      setAuthMsg(`Refresh error: ${e.message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSearchScenes = async () => {
    setAuthBusy(true);
    setAuthMsg("Querying Bhoonidhi STAC catalog for EOS-04 SAR flood scenes…");
    try {
      const stac = await searchBhoonidhiImagery("brahmaputra", "EOS-04_SAR");
      setBhoonidhiStac(stac);
      setAuthMsg(`Found ${stac.matched} verified radar scenes for Assam Brahmaputra basin.`);
    } catch (e: any) {
      setAuthMsg(`STAC query error: ${e.message}`);
    } finally {
      setAuthBusy(false);
    }
  };

  return <div className="tp-secondary-grid">
    <section className="tp-card tp-secondary-panel">
      <div className="tp-card-heading"><span><RefreshCw size={18} /> Data Sources</span>
        <button type="button" className="tp-button tp-primary" disabled={busy} onClick={onSync}>Refresh data</button>
      </div>
      <p className="tp-view-intro">Refresh the four portal feeds. TerraPulse uses available samples when a feed is unreachable.</p>
      <div className="tp-table-wrap"><table className="tp-table">
        <thead><tr><th>Portal</th><th>Source</th><th>Records</th><th>Synced, IST</th></tr></thead>
        <tbody>{["MOSDAC", "Bhoonidhi", "VEDAS", "Bhuvan"].map((name) => {
          const portal = sources?.[name];
          return <tr key={name}><th scope="row">{name}</th><td>{portal ? SOURCE_NAMES[portal.source_type] : "Built-in exercise"}</td>
            <td>{portal?.records_ingested ?? "—"}</td><td>{portal ? timeOf(portal.last_synced_at) : "—"}</td></tr>;
        })}</tbody>
      </table></div>
    </section>

    <section className="tp-card tp-secondary-panel">
      <div className="tp-card-heading"><span><Satellite size={18} /> ISRO Bhoonidhi Programmatic Gateway</span>
        <span className="hud-badge-tag" style={{ background: "#064e3b", color: "#6ee7b7", padding: "3px 8px", borderRadius: 4 }}>API KEY: 1104f7...134c</span>
      </div>
      <p className="tp-view-intro">Programmatic OAuth2/JWT token authentication for ISRO NRSC Bhoonidhi Satellite Imagery API (EOS-04 SAR / Sentinel-2).</p>
      
      <div style={{ display: "grid", gap: 10, margin: "12px 0" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="tp-button tp-primary" disabled={authBusy} onClick={handleAuthenticate}>
            <Key size={14} /> Authenticate Session
          </button>
          <button type="button" className="tp-button" disabled={authBusy || !bhoonidhiAuth} onClick={handleRefresh}>
            <RefreshCw size={14} /> Rotate Refresh Token
          </button>
          <button type="button" className="tp-button" disabled={authBusy} onClick={handleSearchScenes}>
            <Satellite size={14} /> Search EOS-04 SAR Scenes
          </button>
        </div>

        {authMsg && <div style={{ fontSize: 12, color: "#38bdf8", background: "rgba(56, 189, 248, 0.1)", padding: "6px 10px", borderRadius: 6 }}>
          {authMsg}
        </div>}

        {bhoonidhiAuth && (
          <div style={{ background: "#070e1b", border: "1px solid #1e293b", borderRadius: 8, padding: 10, fontSize: 11, fontFamily: "monospace", display: "grid", gap: 4 }}>
            <div style={{ color: "#22c55e", fontWeight: 700 }}>● Status: {bhoonidhiAuth.status.toUpperCase()} (Expires in {bhoonidhiAuth.expires_in}s)</div>
            <div style={{ color: "#94a3b8", wordBreak: "break-all" }}><strong>access_token:</strong> {bhoonidhiAuth.access_token}</div>
            <div style={{ color: "#94a3b8", wordBreak: "break-all" }}><strong>refresh_token:</strong> {bhoonidhiAuth.refresh_token}</div>
            <div style={{ color: "#64748b" }}>scope: {bhoonidhiAuth.scope} · gateway: {bhoonidhiAuth.gateway}</div>
          </div>
        )}

        {bhoonidhiStac?.scenes && (
          <div style={{ background: "#070e1b", border: "1px solid #1e293b", borderRadius: 8, padding: 10, fontSize: 11 }}>
            <strong style={{ color: "#f8fafc", display: "block", marginBottom: 6 }}>Active Bhoonidhi STAC Scenes ({bhoonidhiStac.matched})</strong>
            {bhoonidhiStac.scenes.map((scene) => (
              <div key={scene.scene_id} style={{ borderTop: "1px solid #1e293b", paddingTop: 6, marginTop: 4 }}>
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>{scene.satellite} · {scene.sensor}</span>
                <p style={{ margin: "2px 0", color: "#94a3b8" }}>{scene.target} (Pol: {scene.polarization}, Res: {scene.resolution_m}m)</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>

    <section className="tp-card tp-secondary-panel">
      <div className="tp-card-heading"><span><Radio size={18} /> Exercise Connectivity</span></div>
      <p className="tp-view-intro">Pause the simulated mobile network to practice saving help requests. Restore the connection to sync them.</p>
      <div className="tp-settings-actions">
        <button type="button" className="tp-button" disabled={busy} onClick={onMode}>
          {state.mode === "CELL_BLACKOUT_MESH_ACTIVE" ? "Restore connection" : "Simulate network blackout"}
        </button>
        <button type="button" className="tp-button" disabled={busy} onClick={onReset}>Reset exercise</button>
      </div>
    </section>
  </div>;
}
