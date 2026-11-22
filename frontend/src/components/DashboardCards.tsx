"use client";

import { useState } from "react";
import { Activity, Bell, Check, CloudRain, Droplets, MapPin, Radio, Route, Send, Users } from "lucide-react";
import Sparkline from "@/components/primitives/Sparkline";
import { type ActiveLayers, type LayerKey, LAYERS, LABELS } from "@/lib/layers";
import { formatNumber, timeOf, type Brief } from "@/lib/briefing";
import { type Region } from "@/lib/regions";
import { type GeoJsonFeature, type TerraPulseStateResponse } from "@/lib/terrapulseClient";

export const CARD_METRICS = [
  { key: "heavy_rain_alerts", label: "Heavy Rain Alerts", icon: CloudRain, color: "#5BC0FF", decimals: 0 },
  { key: "flooded_area_km2", label: "Flooded Area", icon: Droplets, color: "#2DD4C4", decimals: 1 },
  { key: "people_at_risk", label: "People at Risk", icon: Users, color: "#FF8A3D", decimals: 0 },
  { key: "active_alerts", label: "Active Alerts", icon: Bell, color: "#B79CFF", decimals: 0 },
] as const;
const EXERCISE_TRENDS = [
  [0, 1, 2, 1, 3, 1, 0], [12, 19, 15, 26, 24, 36, 41], [1, 3, 4, 7, 6, 12, 11], [0, 1, 1, 3, 2, 5, 2],
];

export function KpiCards({ state, history, sample }: {
  state: TerraPulseStateResponse; history: number[][]; sample: boolean;
}) {
  const data = state.kpis;
  const captions = [
    `Above ${state.features.metadata.rainfall_threshold_mm_hr ?? 15} mm/hr`,
    "Mapped standing water", `${formatNumber(data?.active_sos_count ?? 0)} help requests`,
    `${formatNumber(data?.active_mesh_relays ?? 0)} mesh relays active`,
  ];
  return <div className="tp-kpis">
    {CARD_METRICS.map(({ key, label, icon: Icon, color, decimals }, index) => {
      const value = data[key];
      const trend = history[index]?.length > 1 ? history[index] : sample
        ? [...EXERCISE_TRENDS[index].slice(0, -1), value] : [value, value];
      return <article className={`tp-card tp-kpi tp-kpi-${key}`} key={key}>
        <div className="tp-kpi-top"><span className="tp-metric-icon"><Icon size={18} strokeWidth={1.9} /></span><h2>{label}</h2></div>
        <p className="tp-metric-value">{formatNumber(value, decimals)}{key === "flooded_area_km2" && <span> km²</span>}</p>
        <p className="tp-metric-caption">{captions[index]}</p>
        <div className="tp-metric-trend" role="img" aria-label={history[index]?.length > 1 ? "Recorded trend" : sample ? "Exercise trend" : "Current reading"}>
          <Sparkline data={trend} color={color} width={96} height={30} strokeWidth={1.6} fillOpacity={.18} />
        </div>
      </article>;
    })}
  </div>;
}

export function SeverityBadge({ severity }: { severity: Brief["severity"] }) {
  return <span className={`tp-severity tp-severity-${severity.toLowerCase()}`}>
    {severity === "LOW" ? "Monitoring" : severity === "MODERATE" ? "Watch" : severity === "HIGH" ? "Warning" : "Critical"}
  </span>;
}

const ALERT_TABS = ["Details", "Impact", "Resources"] as const;

export function AlertCard({ brief, resources, onResource, onDispatch, onRain, disabled }: {
  brief: Brief;
  resources: GeoJsonFeature[];
  onResource: (feature: GeoJsonFeature) => void;
  onDispatch: () => void;
  onRain: () => void;
  disabled: boolean;
}) {
  const [tab, setTab] = useState<(typeof ALERT_TABS)[number]>("Details");
  const [checked, setChecked] = useState<string[]>([]);
  return (
    <section className="tp-card tp-alert-card" data-severity={brief.severity.toLowerCase()} aria-label="Alert and action">
      <div className="tp-card-heading"><span><Bell size={17} /> Alert &amp; Action</span><SeverityBadge severity={brief.severity} /></div>
      <div className="tp-alert-title">
        <p><MapPin size={14} /> {brief.place}</p>
        <h2>{brief.title}</h2>
        <small>{brief.time ? `Reported ${timeOf(brief.time)} IST` : "Map selection"}</small>
      </div>
      <div className="tp-tabs" role="tablist" aria-label="Alert information">
        {ALERT_TABS.map((label, index) => (
          <button key={label} id={`brief-${label}`} type="button" role="tab" aria-selected={tab === label}
            tabIndex={tab === label ? 0 : -1} aria-controls="brief-panel" onClick={() => setTab(label)}
            onKeyDown={(event) => {
              const keys: Record<string, number> = {
                ArrowLeft: (index + ALERT_TABS.length - 1) % ALERT_TABS.length,
                ArrowRight: (index + 1) % ALERT_TABS.length,
                Home: 0,
                End: ALERT_TABS.length - 1,
              };
              const next = keys[event.key];
              if (typeof next !== "number") return;
              event.preventDefault();
              setTab(ALERT_TABS[next]);
              event.currentTarget.parentElement?.querySelectorAll("button")[next]?.focus();
            }}>{label}</button>
        ))}
      </div>
      <div className="tp-alert-body" role="tabpanel" id="brief-panel" aria-labelledby={`brief-${tab}`} aria-live="polite">
        {tab === "Details" && <>
          <h3>What happened</h3><p>{brief.what}</p>
          <h3>Who may be affected</h3><p>{brief.impact}</p>
          <h3>Recommended Actions</h3>
          <ul className="tp-checklist">
            {brief.actions.map((action) => {
              const isChecked = checked.includes(action);
              return <li key={action}><button type="button" role="checkbox" aria-checked={isChecked}
                onClick={() => setChecked((items) => isChecked ? items.filter((item) => item !== action) : [...items, action])}>
                <span className="tp-check" aria-hidden="true">{isChecked && <Check size={12} />}</span>{action}
              </button></li>;
            })}
          </ul>
        </>}
        {tab === "Impact" && <><h3>Who may be affected</h3><p>{brief.impact}</p><h3>What to do next</h3><p>{brief.actions[0]}</p></>}
        {tab === "Resources" && <>
          <h3>Nearby help points</h3>
          {resources.length ? <ul className="tp-resource-list">{resources.map((f, index) => <li key={f.id ?? index}>
            <button type="button" onClick={() => onResource(f)}><MapPin size={14} /> <span>{f.properties.title}
              <small>{LABELS[f.properties.asset_type ?? "NONE"]}</small></span></button>
          </li>)}</ul> : <p>No relief points are mapped near this location.</p>}
        </>}
      </div>
      <div className="tp-alert-actions">
        <button type="button" className="tp-button tp-primary" onClick={onDispatch} disabled={disabled}><Send size={15} /> Send safe route</button>
        <button type="button" className="tp-button" onClick={onRain} disabled={disabled}><CloudRain size={15} /> Simulate rain</button>
      </div>
    </section>
  );
}

export interface ActivityEntry { title: string; detail: string; time: string; tone: "rain" | "flood" | "warm" | "mesh" }

export function RecentActivity({ entries, region }: { entries: ActivityEntry[]; region: Region }) {
  return <section className="tp-card tp-bottom-card">
    <div className="tp-card-heading"><span><Activity size={17} /> Recent Activity</span></div>
    <ol className="tp-activity">
      {entries.length ? entries.slice(0, 4).map((entry, index) => (
        <li key={`${entry.time}-${index}`} className={`tp-activity-${entry.tone}`}>
          <span className="tp-activity-dot" /><div><strong>{entry.title}</strong><p>{entry.detail}</p></div>
          <time dateTime={entry.time}>{timeOf(entry.time)}</time>
        </li>
      )) : <li><div><strong>Monitoring {region.short_name}</strong><p>Map records are ready to explore.</p></div></li>}
    </ol>
  </section>;
}

export function LayerCard({ active, onToggle, all = false }: {
  active: ActiveLayers; onToggle: (id: LayerKey) => void; all?: boolean;
}) {
  const rows = all ? LAYERS : LAYERS.filter((layer) => layer.id !== "vedas_roads" && layer.id !== "sos_mesh");
  return <section className="tp-card tp-bottom-card tp-layer-card" aria-label="Data layer controls">
    <div className="tp-card-heading"><span><Droplets size={17} /> Data Layers</span></div>
    <div className="tp-layer-list">
      {rows.map(({ id, icon: Icon, name, description, provider, color }) => <div className="tp-layer-row" key={id}>
        <span className="tp-layer-icon" style={{ color }}><Icon size={17} aria-hidden /></span>
        <span className="tp-layer-copy"><strong>{name}</strong><small>{description}</small>{all && <small>{provider}</small>}</span>
        <button type="button" role="switch" aria-label={name} aria-checked={active[id]} title={`${name} · ${provider}`}
          className="tp-switch" onClick={() => onToggle(id)}><span /></button>
      </div>)}
    </div>
  </section>;
}

export function MeshCard({ state, offline, region }: { state: TerraPulseStateResponse; offline: boolean; region: Region }) {
  return <section className="tp-card tp-bottom-card tp-mesh-card">
    <div className="tp-card-heading"><span><Radio size={17} /> Off-Grid Rescue Mesh</span></div>
    <p>Find your location, save an SOS and find nearby shelters when mobile service drops.</p>
    <div className="tp-mesh-status"><span />{offline ? "Offline mesh exercise active" : state.mode === "BACKHAUL_SYNC" ? "Connection restored" : "Ready for an exercise"}</div>
    <a className="tp-button" href={`/field?region=${region.id}`}><Route size={16} /> Open Field Responder</a>
    <small>NavIC + LoRa / BLE simulation</small>
  </section>;
}
