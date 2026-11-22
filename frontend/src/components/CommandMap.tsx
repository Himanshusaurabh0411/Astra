"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Box, Clock, Crosshair, Layers3, Minus, Plus, Radar, RotateCcw } from "lucide-react";
import basemap from "@/lib/india-basemap.json";
import { loadGoogleMaps, onGoogleAuthFailure, HAS_GOOGLE_MAPS, type GoogleMap, type MapStyle } from "@/lib/googleMaps";
import { INDIA, INDIA_REGIONS, inBounds, type Bounds, type Point, type Region } from "@/lib/regions";
import {
  featurePoint, featureRegion, type DispatchVector, type GeoJsonFeature, type GeoJsonGeometry, type HazardSeverity, type SOSPacket,
} from "@/lib/terrapulseClient";
import { mapColor, type ActiveLayers } from "@/lib/layers";
import { useSatelliteFrame } from "@/lib/satelliteImagery";

export interface MapTarget {
  center: Point;
  zoom: number;
  bbox?: Bounds;
  label: string;
}

export type MapSelection = GeoJsonFeature | SOSPacket;

export interface TacticalEmergency {
  id: string;
  title: string;
  type: "squad" | "hazard";
  subType: "ambulance" | "ship" | "boat" | "warning" | "fire" | "wave";
  icon: string;
  badgeText?: string;
  point: Point;
  severity: HazardSeverity;
  theme: "crimson" | "teal" | "navy" | "amber" | "cyan";
  headline: string;
  details: string;
  actionText: string;
}

export const TACTICAL_EMERGENCIES: TacticalEmergency[] = [
  {
    id: "sdrf-bravo-2",
    title: "SDRF Trauma Ambulance Bravo-2",
    type: "squad",
    subType: "ambulance",
    icon: "🚑",
    badgeText: "🚑 SDRF Trauma Ambulance Bravo-2",
    point: [77.4126, 23.2599], // Bhopal / MP
    severity: "CRITICAL",
    theme: "crimson",
    headline: "Critical Care Unit Bravo-2 stationed along NH-46 corridor.",
    details: "Equipped with advanced resuscitation kits, VHF/NavIC telemetry relay, and rapid extrication gear for flood rescue.",
    actionText: "Keep NH-46 corridor clear and maintain live satellite link.",
  },
  {
    id: "icg-interceptor-438",
    title: "ICG Interceptor C-438",
    type: "squad",
    subType: "ship",
    icon: "🚢",
    badgeText: "🚢 ICG Interceptor C-438",
    point: [86.5200, 19.8100], // Offshore Odisha / Bay of Bengal
    severity: "HIGH",
    theme: "teal",
    headline: "Indian Coast Guard high-speed interceptor patrolling Bay of Bengal.",
    details: "Monitoring offshore maritime distress signals, heavy swell warnings, and coastal trawler traffic off Paradip.",
    actionText: "Relay storm surge alerts over maritime radio frequencies.",
  },
  {
    id: "ndrf-flotilla-4",
    title: "NDRF Flotilla Delta-4",
    type: "squad",
    subType: "boat",
    icon: "🚤",
    badgeText: "🚤 NDRF Flotilla Delta-4",
    point: [80.3200, 13.0800], // Offshore Tamil Nadu / Chennai
    severity: "HIGH",
    theme: "navy",
    headline: "NDRF Flood Evacuation Flotilla deployed in coastal waters.",
    details: "Motorized rescue boats on 10-minute readiness for estuarine and shallow-water humanitarian extraction.",
    actionText: "Coordinate safe landing zones with district disaster collectors.",
  },
  {
    id: "hazard-warn-punjab",
    title: "Severe Weather Warning · Punjab / Haryana",
    type: "hazard",
    subType: "warning",
    icon: "⚠️",
    point: [76.2000, 30.2000],
    severity: "HIGH",
    theme: "amber",
    headline: "Convective squall line and localized wind gusts >60 km/h.",
    details: "MOSDAC INSAT-3DS precipitation telemetry indicates rapid convective cloud formation and hail risk across agricultural zones.",
    actionText: "Issue immediate squall alert and secure high-tension power lines.",
  },
  {
    id: "hazard-fire-haryana",
    title: "Thermal Hotspot Anomaly · Haryana Corridor",
    type: "hazard",
    subType: "fire",
    icon: "🔥",
    point: [76.8500, 29.5000],
    severity: "HIGH",
    theme: "crimson",
    headline: "Intense thermal radiation spike detected via Sentinel-2 SWIR.",
    details: "Open biomass burning anomaly exceeding 52°C surface temperature threshold with elevated particulate matter dispersion.",
    actionText: "Alert local fire responders and environmental monitoring patrol.",
  },
  {
    id: "hazard-fire-surat",
    title: "Industrial Thermal Anomaly · Surat Belt",
    type: "hazard",
    subType: "fire",
    icon: "🔥",
    point: [72.8311, 21.1702],
    severity: "HIGH",
    theme: "crimson",
    headline: "Surface temperature spike in Tapi estuarine industrial cluster.",
    details: "Thermal infrared sensors report localized heat accumulation +18°C above seasonal baseline.",
    actionText: "Verify industrial fire suppression and monitor chemical storage perimeters.",
  },
  {
    id: "hazard-fire-bhopal",
    title: "Thermal Anomaly · Central MP Zone",
    type: "hazard",
    subType: "fire",
    icon: "🔥",
    point: [77.4126, 23.2000],
    severity: "HIGH",
    theme: "crimson",
    headline: "Biomass heat signature detected adjacent to Sehore catchment.",
    details: "Satellite thermal radiometer marks rapid rise in surface temperature across dry scrubland.",
    actionText: "Mobilize forest rangers and prepare fire break lines.",
  },
  {
    id: "hazard-wave-mumbai",
    title: "High Tidal Surge · Mumbai Harbor",
    type: "hazard",
    subType: "wave",
    icon: "🌊",
    point: [72.8200, 18.9500],
    severity: "HIGH",
    theme: "cyan",
    headline: "Arabian Sea tidal swell exceeding 4.5m Spring Tide safety limits.",
    details: "High astronomical tide with strong onshore winds causing sea water ingress along coastal promenades.",
    actionText: "Close low-lying seafront gates and activate auxiliary dewatering pumps.",
  },
  {
    id: "hazard-wave-tamilnadu",
    title: "Marine Surge Alert · Coromandel Offshore",
    type: "hazard",
    subType: "wave",
    icon: "🌊",
    point: [80.8000, 13.5000],
    severity: "HIGH",
    theme: "cyan",
    headline: "Deep maritime depression triggering 3.8m swells along North Tamil Nadu coast.",
    details: "Coastal buoy telemetry indicates rapid atmospheric pressure drop and hazardous wave heights for coastal shipping.",
    actionText: "Halt all beach operations and issue advisory to artisanal fishermen.",
  },
];

// Major Indian Highway Network for Roadmap & Hybrid Modes
const NATIONAL_HIGHWAYS: { name: string; number: string; type: "golden" | "corridor" | "evac"; coords: Point[] }[] = [
  // Golden Quadrilateral
  { name: "Delhi-Mumbai Highway", number: "NH-48", type: "golden", coords: [[77.21, 28.61], [75.82, 26.92], [74.63, 24.88], [73.18, 22.30], [72.83, 21.17], [72.88, 19.08]] },
  { name: "Mumbai-Chennai Highway", number: "NH-48", type: "golden", coords: [[72.88, 19.08], [73.85, 18.52], [74.24, 16.70], [75.91, 14.46], [77.59, 12.97], [79.13, 12.92], [80.27, 13.08]] },
  { name: "Chennai-Kolkata Highway", number: "NH-16", type: "golden", coords: [[80.27, 13.08], [80.05, 14.44], [80.64, 16.51], [82.23, 16.98], [83.21, 17.68], [85.82, 20.30], [86.92, 21.49], [87.32, 22.34], [88.36, 22.57]] },
  { name: "Kolkata-Delhi GT Road", number: "NH-19", type: "golden", coords: [[88.36, 22.57], [87.08, 23.68], [85.31, 23.34], [84.99, 24.79], [83.00, 25.31], [81.84, 25.43], [80.33, 26.44], [78.01, 27.18], [77.21, 28.61]] },
  // North-South & East-West Corridors
  { name: "North-South Corridor", number: "NH-44", type: "corridor", coords: [[74.80, 34.08], [74.86, 32.73], [75.86, 30.90], [76.99, 29.69], [77.21, 28.61], [77.72, 27.50], [78.17, 26.22], [78.57, 25.45], [78.80, 23.83], [79.08, 21.14], [78.49, 17.39], [77.98, 15.83], [77.59, 12.97], [78.16, 11.66], [78.12, 9.92], [77.54, 8.08]] },
  { name: "East-West Corridor", number: "NH-27", type: "corridor", coords: [[69.60, 21.64], [70.80, 22.30], [72.64, 23.22], [73.68, 24.58], [75.83, 25.18], [77.65, 25.43], [78.57, 25.45], [80.33, 26.44], [80.95, 26.85], [83.37, 26.76], [85.39, 26.12], [88.36, 26.72], [89.98, 26.50], [91.74, 26.14], [92.79, 24.83]] },
  // Emergency Evacuation Corridor
  { name: "Central Ridge Evacuation Corridor", number: "NH-46", type: "evac", coords: [[75.86, 22.72], [76.35, 22.96], [77.05, 23.15], [77.20, 23.18], [77.41, 23.26], [78.74, 23.83]] },
];

// Major Indian Cities
const MAJOR_CITIES: { name: string; point: Point; tier: 1 | 2 }[] = [
  { name: "NEW DELHI", point: [77.21, 28.61], tier: 1 },
  { name: "MUMBAI", point: [72.88, 19.08], tier: 1 },
  { name: "BENGALURU", point: [77.59, 12.97], tier: 1 },
  { name: "CHENNAI", point: [80.27, 13.08], tier: 1 },
  { name: "KOLKATA", point: [88.36, 22.57], tier: 1 },
  { name: "HYDERABAD", point: [78.49, 17.39], tier: 1 },
  { name: "AHMEDABAD", point: [72.57, 23.02], tier: 2 },
  { name: "BHOPAL", point: [77.41, 23.26], tier: 2 },
  { name: "JAIPUR", point: [75.82, 26.92], tier: 2 },
  { name: "LUCKNOW", point: [80.95, 26.85], tier: 2 },
  { name: "PATNA", point: [85.14, 25.61], tier: 2 },
  { name: "GUWAHATI", point: [91.74, 26.14], tier: 2 },
  { name: "SRINAGAR", point: [74.80, 34.08], tier: 2 },
  { name: "BHUBANESWAR", point: [85.82, 20.30], tier: 2 },
];

// Topographic Mountain Peaks for Terrain Mode
const MOUNTAIN_PEAKS: { name: string; elevation: string; point: Point }[] = [
  { name: "Kanchenjunga", elevation: "8,586m", point: [88.14, 27.70] },
  { name: "Nanda Devi", elevation: "7,816m", point: [79.97, 30.37] },
  { name: "Anamudi", elevation: "2,695m", point: [77.06, 10.17] },
  { name: "Dodabetta", elevation: "2,637m", point: [76.73, 11.40] },
  { name: "Guru Shikhar", elevation: "1,722m", point: [72.78, 24.65] },
  { name: "Kalsubai", elevation: "1,646m", point: [73.71, 19.60] },
];

// Major Rivers for Terrain Mode
const MAJOR_RIVERS: { name: string; path: Point[] }[] = [
  { name: "Ganga", path: [[78.60, 30.15], [78.16, 29.95], [80.33, 26.44], [81.84, 25.43], [83.00, 25.31], [85.14, 25.61], [87.57, 25.25], [88.16, 24.80], [88.36, 22.57]] },
  { name: "Brahmaputra", path: [[95.35, 28.15], [94.90, 27.48], [92.80, 26.65], [91.74, 26.14], [89.98, 26.00]] },
  { name: "Narmada", path: [[81.75, 22.67], [79.95, 23.16], [77.73, 22.75], [75.60, 22.18], [72.98, 21.70], [72.58, 21.65]] },
  { name: "Godavari", path: [[73.53, 19.93], [75.33, 19.88], [77.30, 19.15], [79.55, 18.77], [81.78, 16.98], [82.23, 16.73]] },
  { name: "Krishna", path: [[73.66, 17.92], [75.87, 16.83], [77.35, 16.52], [80.64, 16.51], [80.90, 15.78]] },
];

const ENGINE_TITLES: Record<MapStyle, { name: string; count: string }> = {
  hybrid: { name: "Google Maps Satellite Engine", count: "9 Emergencies Mapped" },
  satellite: { name: "Sentinel-2 / Landsat Satellite Feed", count: "Multi-Spectral Band 8A" },
  terrain: { name: "Cartosat DEM Topographic Elevation", count: "Shaded Relief Active" },
  roadmap: { name: "National Highway Logistics Grid", count: "All Corridors Open" },
};

interface Props {
  target: MapTarget;
  features: GeoJsonFeature[];
  activeLayers: ActiveLayers;
  sosPackets?: SOSPacket[];
  dispatches?: DispatchVector[];
  offline?: boolean;
  onSelect?: (item: MapSelection) => void;
  onRegion?: (region: Region) => void;
  onPoint?: (point: Point) => void;
  onLayers?: () => void;
  onSync?: () => void;
  location?: Point;
  allowTilt?: boolean;
}

interface Dimensions { width: number; height: number }
interface View { center: Point; scale: number }
interface Marker {
  id: string; label: string; point: Point; color: string; pulse?: boolean;
  shape?: "asset" | "sos"; select?: () => void; offset?: Point;
}

const MODES = [
  { key: "hybrid", label: "Hybrid" },
  { key: "satellite", label: "Satellite" },
  { key: "terrain", label: "Terrain" },
  { key: "roadmap", label: "Roadmap" },
] as const;

const SOS_COLOR = "#FF6868";
const ROUTE_COLOR = "#F5D547";
const PULSE_COLOR = "#FF8A3D";

const boundsForImage = basemap.terrainBounds as Bounds;
const borderPaths = basemap.polygons.map(({ india, rings }) => ({
  india,
  path: rings.map((ring) => ring.map(([x, y], index) => `${index ? "L" : "M"}${x},${y}`).join(" ") + "Z").join(" "),
}));

function scaleFor(target: MapTarget, size: Dimensions): number {
  const [west, south, east, north] = target.bbox ?? INDIA.bbox;
  const regional = target.bbox && north - south < 22;
  if (!target.bbox) return 2 ** (target.zoom - 4) * 13;
  const xScale = Math.cos(target.center[1] * Math.PI / 180);
  return Math.min((size.width - (regional ? 112 : 78)) / ((east - west) * xScale),
    (size.height - (regional ? 72 : 38)) / (north - south));
}

function geometryPath(geometry: GeoJsonGeometry, project: (point: Point) => Point): string {
  const line = (points: Point[]) => points.map((point, i) => {
    const [x, y] = project(point);
    return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  if (geometry.type === "LineString") return line(geometry.coordinates);
  if (geometry.type === "Polygon") return geometry.coordinates.map((ring) => line(ring) + "Z").join(" ");
  if (geometry.type === "MultiPolygon") return geometry.coordinates.flatMap((poly) => poly.map((ring) => line(ring) + "Z")).join(" ");
  return "";
}

function activate(event: KeyboardEvent, select: () => void) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    select();
  }
}

export default function CommandMap({
  target, features, activeLayers, sosPackets = [], dispatches = [], offline = false,
  onSelect, onRegion, onPoint, onLayers, onSync, location, allowTilt = false,
}: Props) {
  const shell = useRef<HTMLDivElement>(null);
  const googleHost = useRef<HTMLDivElement>(null);
  const googleMap = useRef<GoogleMap>();
  const [size, setSize] = useState<Dimensions>({ width: 840, height: 480 });
  const [mapStyle, setMapStyle] = useState<MapStyle>("hybrid");
  const [tilt, setTilt] = useState(false);
  const [googleStatus, setGoogleStatus] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [view, setView] = useState<View>(() => ({ center: target.center, scale: scaleFor(target, size) }));
  const currentView = useRef(view);
  const animation = useRef<number>();
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; center: Point; scale: number; moved: boolean }>();
  const selectItem = useRef(onSelect);
  const currentTarget = useRef(target);
  const currentStyle = useRef(mapStyle);

  // Floating filter toolbar states
  const [filterRadar, setFilterRadar] = useState(true);
  const [filterThermal, setFilterThermal] = useState(true);
  const [filterRoutes, setFilterRoutes] = useState(true);
  const [filterSquads, setFilterSquads] = useState(true);

  // Live clocks for UTC and IST
  const [clocks, setClocks] = useState({ zulu: "00:54:18", ist: "06:24:18" });

  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const zulu = now.toISOString().slice(11, 19);
      const ist = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Asia/Kolkata",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      }).format(now);
      setClocks({ zulu, ist });
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  selectItem.current = onSelect;
  currentTarget.current = target;
  currentStyle.current = mapStyle;
  currentView.current = view;

  useEffect(() => {
    if (!shell.current) return;
    const observer = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(shell.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const next = { center: target.center, scale: Math.max(2, scaleFor(target, size)) };
    const start = currentView.current;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setView(next);
    } else {
      const started = performance.now();
      const animate = (time: number) => {
        const fraction = Math.min(1, (time - started) / 300);
        const t = 1 - (1 - fraction) ** 3;
        setView({
          center: [
            start.center[0] + (next.center[0] - start.center[0]) * t,
            start.center[1] + (next.center[1] - start.center[1]) * t,
          ],
          scale: start.scale * (next.scale / start.scale) ** t,
        });
        if (fraction < 1) animation.current = requestAnimationFrame(animate);
      };
      animation.current = requestAnimationFrame(animate);
    }
    const map = googleMap.current;
    if (map) {
      map.panTo({ lng: target.center[0], lat: target.center[1] });
      map.setZoom(target.zoom);
    }
    return () => { if (animation.current !== undefined) cancelAnimationFrame(animation.current); };
  }, [target, size]);

  useEffect(() => {
    if (offline || !HAS_GOOGLE_MAPS) {
      setGoogleStatus("idle");
      return;
    }
    const host = googleHost.current;
    if (!host) return;
    let stopped = false;
    let tileWait: ReturnType<typeof setTimeout> | undefined;
    let tileListener: { remove(): void } | undefined;
    setGoogleStatus("loading");
    const fallback = () => {
      if (!stopped) {
        setGoogleStatus("fallback");
        googleMap.current = undefined;
        host.replaceChildren();
      }
    };
    const stopAuth = onGoogleAuthFailure(fallback);
    const observer = new MutationObserver(() => {
      if (host.querySelector(".gm-err-container")) fallback();
    });
    observer.observe(host, { childList: true, subtree: true });

    void loadGoogleMaps().then((api) => {
      if (stopped) return;
      const mapTarget = currentTarget.current;
      const map = new api.Map(host, {
        center: { lng: mapTarget.center[0], lat: mapTarget.center[1] }, zoom: mapTarget.zoom,
        minZoom: 3, maxZoom: 18, mapTypeId: currentStyle.current,
        disableDefaultUI: true, clickableIcons: false, gestureHandling: "cooperative",
        backgroundColor: "#14242c", keyboardShortcuts: true,
      });
      googleMap.current = map;
      tileListener = map.addListener("tilesloaded", () => {
        clearTimeout(tileWait);
        if (!stopped && googleMap.current === map) setGoogleStatus("ready");
      });
      tileWait = setTimeout(fallback, 7000);
    }).catch(fallback);

    return () => {
      stopped = true;
      clearTimeout(tileWait);
      tileListener?.remove();
      stopAuth();
      observer.disconnect();
      googleMap.current = undefined;
      host.replaceChildren();
    };
  }, [offline]);

  useEffect(() => {
    googleMap.current?.setMapTypeId(mapStyle);
  }, [mapStyle]);

  const visible = useMemo(() => features.filter((feature) =>
    activeLayers[feature.properties.layer] && feature.properties.record_kind !== "crop_stress"), [features, activeLayers]);
  const sos = activeLayers.sos_mesh ? sosPackets : [];
  const routes = (activeLayers.vedas_corridors && filterRoutes) ? dispatches : [];
  const usingGoogle = googleStatus === "ready" && !offline;

  const satelliteFrame = useSatelliteFrame(!offline && mapStyle !== "roadmap" && (!HAS_GOOGLE_MAPS || googleStatus === "fallback"),
    dragging, view.center, view.scale, size.width, size.height);

  useEffect(() => {
    if (!usingGoogle || !googleMap.current || !window.google) return;
    const { data } = googleMap.current;
    const items = new Map<string, MapSelection>();
    const overlays = visible.map((f, i) => {
      const key = `f-${i}`;
      items.set(key, f);
      return { type: "Feature", geometry: f.geometry, properties: { key, color: mapColor(f.properties) } };
    });
    sos.forEach((packet) => {
      const key = packet.sos_id;
      items.set(key, packet);
      overlays.push({
        type: "Feature", geometry: { type: "Point", coordinates: [packet.position.lng, packet.position.lat] },
        properties: { key, color: SOS_COLOR },
      });
    });
    for (const dispatch of routes) overlays.push({
      type: "Feature", geometry: dispatch.evacuation_corridor, properties: { key: "", color: ROUTE_COLOR },
    });
    if (location) overlays.push({
      type: "Feature", geometry: { type: "Point", coordinates: location }, properties: { key: "", color: PULSE_COLOR },
    });
    const circle = window.google.maps.SymbolPath.CIRCLE;
    data.addGeoJson({ type: "FeatureCollection", features: overlays });
    data.setStyle((feature) => {
      const color = String(feature.getProperty("color"));
      return {
        fillColor: color, fillOpacity: .23, strokeColor: color, strokeWeight: 2,
        icon: { path: circle, scale: 6, fillColor: color, fillOpacity: .95, strokeColor: "#0a1720", strokeWeight: 2 },
      };
    });
    const listener = data.addListener("click", ({ feature }) => {
      const item = items.get(String(feature.getProperty("key")));
      if (item) selectItem.current?.(item);
    });
    return () => { listener.remove(); data.forEach((feature) => data.remove(feature)); };
  }, [visible, sos, routes, location, usingGoogle]);

  const cos = Math.cos(view.center[1] * Math.PI / 180);
  const sx = view.scale * cos;
  const ox = size.width / 2 - view.center[0] * sx;
  const oy = size.height / 2 + view.center[1] * view.scale;
  const project = ([lng, lat]: Point): Point => [ox + lng * sx, oy - lat * view.scale];
  const unproject = (x: number, y: number): Point => [(x - ox) / sx, (oy - y) / view.scale];
  const [pictureX, pictureY] = project([boundsForImage[0], boundsForImage[3]]);
  const scene = satelliteFrame?.bounds;
  const hasScene = scene && ox + scene[2] * sx > 0 && ox + scene[0] * sx < size.width
    && oy - scene[1] * view.scale > 0 && oy - scene[3] * view.scale < size.height;
  const national = view.scale <= 23;
  const drawFeature = (feature: GeoJsonFeature) =>
    feature.geometry.type !== "Point" && (!national || feature.properties.layer === "bhoonidhi_flood");

  const pointMarkers: Marker[] = visible.filter((f) => f.geometry.type === "Point").map((f, index) => ({
    id: f.id ?? `feature-${index}`, label: f.properties.title, point: featurePoint(f),
    color: mapColor(f.properties), shape: f.properties.layer === "bhuvan_assets" ? "asset" : undefined,
    pulse: f.properties.severity === "HIGH" || f.properties.severity === "CRITICAL",
    select: () => onSelect?.(f),
  }));

  const sosMarkers: Marker[] = sos.map((packet) => ({
    id: packet.sos_id, label: `${packet.triage.severity.toLowerCase()} help request · ${packet.triage.headcount} people`,
    point: [packet.position.lng, packet.position.lat], color: SOS_COLOR, shape: "sos", pulse: true,
    select: () => onSelect?.(packet),
  }));

  const regionMarkers: Marker[] = INDIA_REGIONS.flatMap((region) => {
    const regional = visible.filter((f) => featureRegion(f).id === region.id);
    const flood = regional.find((f) => f.properties.layer === "bhoonidhi_flood" && f.properties.water_depth_m);
    const heavy = regional.find((f) => f.properties.layer === "mosdac_rain" && f.properties.severity === "HIGH");
    const loc = region.places[0]?.center ?? region.center;
    const nudge: Point = region.id === "arid-belt" ? [73.0243, 26.2389] : loc;
    return regional.length || onRegion ? [{
      id: region.id, label: region.short_name, point: nudge,
      color: heavy ? PULSE_COLOR : flood ? mapColor(flood.properties) : "#B79CFF",
      pulse: !!heavy || (flood?.properties.water_depth_m ?? 0) >= .75,
      select: onRegion ? () => onRegion(region) : undefined,
    }] : [];
  });

  const markers = national
    ? [...regionMarkers, ...sosMarkers.slice(0, 1).map((marker) => ({ ...marker, offset: [15, 8] as Point }))]
    : [...pointMarkers, ...sosMarkers];
  if (location) markers.push({ id: "location", label: "My location", point: location, color: PULSE_COLOR });

  const recenter = () => {
    if (animation.current !== undefined) cancelAnimationFrame(animation.current);
    setView({ center: target.center, scale: Math.max(2, scaleFor(target, size)) });
    googleMap.current?.panTo({ lng: target.center[0], lat: target.center[1] });
    googleMap.current?.setZoom(target.zoom);
  };

  const zoom = (direction: number) => {
    if (animation.current !== undefined) cancelAnimationFrame(animation.current);
    setView((previous) => ({ ...previous, scale: Math.max(3, Math.min(18000, previous.scale * 1.54 ** direction)) }));
    const map = googleMap.current;
    if (map && usingGoogle) map.setZoom((map.getZoom() ?? target.zoom) + direction);
  };

  const startDrag = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || (event.target as Element).closest("[data-map-action]")) return;
    if (animation.current !== undefined) cancelAnimationFrame(animation.current);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { x: event.clientX, y: event.clientY, center: view.center, scale: view.scale, moved: false };
  };

  const moveDrag = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    if (!start) return;
    const dx = start.x - event.clientX;
    const dy = event.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 4) return;
    start.moved = true;
    setDragging(true);
    setView({
      scale: start.scale,
      center: [Math.min(104, Math.max(58, start.center[0] + dx / (start.scale * cos))),
        Math.min(42, Math.max(4, start.center[1] + dy / start.scale))],
    });
  };

  const stopDrag = (event: PointerEvent<SVGSVGElement>) => {
    const start = drag.current;
    drag.current = undefined;
    setDragging(false);
    if (!start || start.moved || !onPoint || event.type === "pointercancel") return;
    const box = event.currentTarget.getBoundingClientRect();
    const point = unproject(event.clientX - box.left, event.clientY - box.top);
    if (inBounds(point, INDIA.bbox)) onPoint(point);
  };

  const handleSelectEmergency = (item: TacticalEmergency) => {
    const feature: GeoJsonFeature = {
      type: "Feature",
      id: item.id,
      geometry: { type: "Point", coordinates: item.point },
      properties: {
        layer: item.type === "squad" ? "bhuvan_assets" : "bhoonidhi_flood",
        title: item.title,
        place_name: item.title,
        hazard_type: item.headline,
        recommended_action: item.actionText,
        severity: item.severity,
        observed_at: new Date().toISOString(),
        asset_type: item.type === "squad" ? "SHELTER" : undefined,
      },
    };
    onSelect?.(feature);
  };

  const kmPerPixel = 111.32 / Math.max(1, view.scale);
  const scaleKm = [1000, 500, 250, 100, 50, 25, 10, 5, 2, 1].find((km) => km / kmPerPixel <= 106) ?? .5;

  const currentLat = view.center[1].toFixed(4);
  const currentLng = view.center[0].toFixed(4);

  const engineInfo = ENGINE_TITLES[mapStyle] || ENGINE_TITLES.hybrid;

  return (
    <div className={`map-canvas ${allowTilt && tilt ? "map-tilted" : ""} map-canvas-${mapStyle}`} ref={shell} aria-label={`Interactive map of ${target.label}`}>
      {/* 1. TOP HEADER BAR INSIDE MAP */}
      <div className="tp-map-top-bar">
        <div className="tp-map-engine-badge">
          <span className={offline ? "tp-glow-dot-amber" : "tp-glow-dot-emerald"} />
          <span className="engine-name">{offline ? "⚡ Offline LoRa Mesh (865.2 MHz)" : engineInfo.name}</span>
          <span className="engine-sep">|</span>
          <span className="engine-count">{offline ? "NavIC Locked · 6 Relay Hops Active" : engineInfo.count}</span>
        </div>

        <div className="map-types" role="group" aria-label="Map view mode">
          {MODES.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              aria-pressed={mapStyle === key}
              className={mapStyle === key ? "active-mode" : ""}
              onClick={() => setMapStyle(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. FLOATING ACTION TOOLBAR */}
      <div className="map-floating-bar" role="toolbar" aria-label="Tactical map controls">
        <button
          type="button"
          className={`floating-pill pill-radar ${filterRadar ? "active" : ""}`}
          onClick={() => setFilterRadar((v) => !v)}
          title="Toggle Doppler radar & precipitation"
        >
          <span>🌧️</span> Radar
        </button>
        <button
          type="button"
          className={`floating-pill pill-thermal ${filterThermal ? "active" : ""}`}
          onClick={() => setFilterThermal((v) => !v)}
          title="Toggle SWIR thermal anomalies & hotspots"
        >
          <span>🔥</span> Thermal
        </button>
        <button
          type="button"
          className={`floating-pill pill-routes ${filterRoutes ? "active" : ""}`}
          onClick={() => setFilterRoutes((v) => !v)}
          title="Toggle VEDAS safe evacuation corridors"
        >
          <span>🧭</span> Routes
        </button>
        <button
          type="button"
          className={`floating-pill pill-squads ${filterSquads ? "active" : ""}`}
          onClick={() => setFilterSquads((v) => !v)}
          title="Toggle active disaster response units"
        >
          <span>🛡️</span> Squads
        </button>
        <button
          type="button"
          className="floating-action-btn"
          title="Recenter Map"
          aria-label="Recenter map"
          onClick={recenter}
        >
          <Crosshair size={14} className="hud-amber" />
        </button>
        <button
          type="button"
          className="floating-action-btn"
          title="Sync Satellite Feeds"
          aria-label="Sync satellite feeds"
          onClick={() => onSync?.()}
        >
          <RotateCcw size={13} />
        </button>
      </div>

      {/* 3. BASE SVG MAP CANVAS */}
      <svg
        className={`local-map ${dragging ? "dragging" : ""}`}
        width="100%"
        height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`}
        role="group"
        aria-label="India terrain and emergency layer map"
        onPointerDown={startDrag}
        onPointerMove={moveDrag}
        onPointerUp={stopDrag}
        onPointerCancel={stopDrag}
      >
        <defs>
          <radialGradient id="map-vignette">
            <stop offset="45%" stopColor="#030916" stopOpacity="0" />
            <stop offset="100%" stopColor="#030916" stopOpacity=".28" />
          </radialGradient>
        </defs>

        {/* Ocean Background */}
        <rect
          width={size.width}
          height={size.height}
          fill={mapStyle === "roadmap" ? "#0a1322" : mapStyle === "satellite" ? "#020617" : "var(--map-sea)"}
        />

        {/* Subcontinent Terrain/Satellite Image */}
        {mapStyle !== "roadmap" && (
          <image
            href="/india-terrain.webp"
            x={pictureX}
            y={pictureY}
            width={(boundsForImage[2] - boundsForImage[0]) * sx}
            height={(boundsForImage[3] - boundsForImage[1]) * view.scale}
            preserveAspectRatio="none"
            className={`map-img-${mapStyle}`}
          />
        )}

        {/* Live Sentinel-2 Scene Layer when active */}
        {hasScene && satelliteFrame?.url && mapStyle !== "roadmap" && (
          <image
            href={satelliteFrame.url}
            x={ox + scene[0] * sx}
            y={oy - scene[3] * view.scale}
            width={(scene[2] - scene[0]) * sx}
            height={(scene[3] - scene[1]) * view.scale}
            preserveAspectRatio="none"
            opacity={0.88}
          />
        )}

        {/* Land Silhouette & Country Borders */}
        <g transform={`matrix(${sx} 0 0 ${-view.scale} ${ox} ${oy})`} pointerEvents="none">
          {borderPaths.map(({ path, india }, index) => (
            <path
              key={index}
              d={path}
              fill={mapStyle === "roadmap" ? (india ? "#111c2e" : "#0d1524") : "none"}
              stroke={india ? (mapStyle === "roadmap" ? "#0284c7" : "var(--map-border)") : "var(--map-border-muted)"}
              strokeWidth={india ? (mapStyle === "roadmap" ? 1.5 : 1.05) : .55}
              strokeOpacity={mapStyle === "satellite" ? .3 : mapStyle === "roadmap" ? .95 : .85}
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </g>

        {/* TERRAIN MODE: Topographic Overlays, Mountain Peaks, and River Drainages */}
        {mapStyle === "terrain" && (
          <g className="map-terrain-overlays" pointerEvents="none">
            {MAJOR_RIVERS.map((river) => {
              const d = river.path.map((pt, i) => {
                const [x, y] = project(pt);
                return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(" ");
              return (
                <path
                  key={river.name}
                  d={d}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="2.2"
                  strokeOpacity="0.85"
                  strokeLinecap="round"
                />
              );
            })}

            {MOUNTAIN_PEAKS.map((peak) => {
              const [x, y] = project(peak.point);
              if (x < -20 || x > size.width + 20 || y < -20 || y > size.height + 20) return null;
              return (
                <g key={peak.name} transform={`translate(${x},${y})`}>
                  <polygon points="0,-7 6,4 -6,4" fill="#f59e0b" stroke="#ffffff" strokeWidth="1.2" />
                  <text x={8} y={3} className="map-peak-label">{peak.name} ({peak.elevation})</text>
                </g>
              );
            })}
          </g>
        )}

        {/* ROADMAP & HYBRID MODES: Major National Highway Corridors & Logistical Cities */}
        {(mapStyle === "roadmap" || mapStyle === "hybrid") && (
          <g className="map-highways-layer" pointerEvents="none">
            {NATIONAL_HIGHWAYS.map((hwy) => {
              const d = hwy.coords.map((pt, i) => {
                const [x, y] = project(pt);
                return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
              }).join(" ");
              const isRoadmap = mapStyle === "roadmap";
              const strokeColor = hwy.type === "golden" ? "#f59e0b" : hwy.type === "evac" ? "#22c55e" : "#06b6d4";
              const strokeWidth = hwy.type === "evac" ? (isRoadmap ? 3.8 : 2.8) : hwy.type === "golden" ? (isRoadmap ? 3.2 : 2.2) : (isRoadmap ? 2.5 : 1.6);
              return (
                <g key={hwy.name}>
                  {isRoadmap && (
                    <path
                      d={d}
                      fill="none"
                      stroke={strokeColor}
                      strokeWidth={strokeWidth + 3.5}
                      strokeOpacity="0.25"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  <path
                    d={d}
                    fill="none"
                    stroke={strokeColor}
                    strokeWidth={strokeWidth}
                    strokeOpacity={isRoadmap ? 0.95 : 0.75}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={hwy.type === "evac" ? "6 4" : undefined}
                  />
                </g>
              );
            })}

            {MAJOR_CITIES.map((city) => {
              const [x, y] = project(city.point);
              if (x < -20 || x > size.width + 20 || y < -20 || y > size.height + 20) return null;
              const isRoadmap = mapStyle === "roadmap";
              return (
                <g key={city.name} transform={`translate(${x},${y})`}>
                  <circle r={city.tier === 1 ? 5 : 3.5} fill="#ffffff" stroke={isRoadmap ? "#0284c7" : "#0f172a"} strokeWidth="2" />
                  {city.tier === 1 && (
                    <circle r="9" fill="none" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.6" />
                  )}
                  <text x={city.tier === 1 ? 8 : 6} y={3} className={`map-city-node ${city.tier === 1 ? "tier-1" : ""}`}>
                    {city.name}
                  </text>
                </g>
              );
            })}
          </g>
        )}

        {national && mapStyle !== "roadmap" && (
          <g className="map-geography" aria-hidden="true" pointerEvents="none">
            <text x={project([81.5, 23.1])[0]} y={project([81.5, 23.1])[1]} className="map-country" textAnchor="middle">INDIA</text>
            <text x={project([67.3, 12.9])[0]} y={project([67.3, 12.9])[1]} textAnchor="middle" className="map-sea-label">Arabian Sea</text>
            <text x={project([88.5, 14.3])[0]} y={project([88.5, 14.3])[1]} textAnchor="middle" className="map-sea-label">Bay of Bengal</text>
          </g>
        )}

        <rect width={size.width} height={size.height} fill="url(#map-vignette)" pointerEvents="none" />

        {/* Disaster & Risk Layers */}
        {visible.filter(drawFeature).map((feature, index) => {
          const d = geometryPath(feature.geometry, project);
          if (!d) return null;
          const color = mapColor(feature.properties);
          const isLine = feature.geometry.type === "LineString";
          const interactive = onSelect ? () => onSelect(feature) : undefined;
          return (
            <g
              key={feature.id ?? index}
              data-map-action=""
              className={interactive ? "map-feature" : undefined}
              role={interactive ? "button" : undefined}
              tabIndex={interactive ? 0 : undefined}
              aria-label={feature.properties.title}
              onClick={interactive}
              onKeyDown={interactive ? (event) => activate(event, interactive) : undefined}
            >
              <title>{feature.properties.title}</title>
              {isLine && <path d={d} stroke="transparent" strokeWidth="15" fill="none" />}
              <path
                d={d}
                fillRule="evenodd"
                fill={isLine ? "none" : color}
                fillOpacity={.23}
                stroke={color}
                strokeWidth={isLine ? 3 : 1.4}
                strokeOpacity={isLine ? 1 : .78}
                strokeLinecap="round"
                strokeDasharray={feature.properties.road_status === "CORRIDOR" ? "7 5" : undefined}
              />
            </g>
          );
        })}

        {/* Active Evacuation Dispatches */}
        {routes.map((dispatch) => {
          const d = geometryPath(dispatch.evacuation_corridor, project);
          const [sx, sy] = project([dispatch.safe_asset.lng, dispatch.safe_asset.lat]);
          return (
            <g key={dispatch.dispatch_id} className="map-dispatch-corridor" pointerEvents="none">
              <path
                d={d}
                fill="none"
                stroke="#22c55e"
                strokeWidth={national ? 5 : 7}
                strokeOpacity={0.35}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d={d}
                fill="none"
                stroke="#4ade80"
                strokeWidth={national ? 2.5 : 3.5}
                strokeDasharray="6 4"
                strokeOpacity={0.95}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <g transform={`translate(${sx},${sy})`}>
                <circle r="12" fill="#22c55e" fillOpacity="0.3" />
                <circle r="6" fill="#22c55e" stroke="#ffffff" strokeWidth="2" />
                <text x="9" y="4" className="map-marker-label" fill="#86efac">
                  {dispatch.safe_asset.name}
                </text>
              </g>
            </g>
          );
        })}

        {/* Offline LoRa Tactical Mesh Links (when offline / blackout active) */}
        {offline && (
          <g className="map-mesh-overlay" pointerEvents="none">
            {TACTICAL_EMERGENCIES.filter((e) => e.type === "squad").slice(0, 2).map((squad, i, arr) => {
              const nextSquad = arr[i + 1] ?? arr[0];
              const [x1, y1] = project(squad.point);
              const [x2, y2] = project(nextSquad.point);
              return (
                <line
                  key={squad.id}
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#38bdf8"
                  strokeWidth="2"
                  strokeDasharray="5 5"
                  strokeOpacity="0.85"
                />
              );
            })}
          </g>
        )}

        {markers.map(({ id, label, point, color, shape, pulse, select, offset }) => {
          const [px, py] = project(point);
          const x = px + (offset?.[0] ?? 0);
          const y = py + (offset?.[1] ?? 0);
          if (x < -42 || x > size.width + 42 || y < -42 || y > size.height + 42) return null;
          return (
            <g
              key={id}
              transform={`translate(${x},${y})`}
              data-map-action=""
              className={select ? "map-feature" : undefined}
              role={select ? "button" : undefined}
              tabIndex={select ? 0 : undefined}
              aria-label={label}
              onClick={select}
              onKeyDown={select ? (event) => activate(event, select) : undefined}
            >
              <title>{label}</title>
              <circle r="14" fill="transparent" />
              {pulse && <circle r={national ? "15" : "13"} fill={color} opacity=".22" />}
              <circle r={national ? "7" : "6"} fill={color} fillOpacity=".94" stroke="#0B1220" strokeWidth="2" />
              {shape === "asset" && <path d="M-2.7 0 H2.7 M0 -2.7 V2.7" stroke="#15132a" strokeWidth="1.6" />}
              {shape === "sos" && <path d="M0 -2.7 V.6 M0 2.5 v.3" stroke="#441019" strokeWidth="1.7" strokeLinecap="round" />}
            </g>
          );
        })}
      </svg>

      {/* 4. GOOGLE MAPS SURFACE */}
      <div
        ref={googleHost}
        aria-hidden={!usingGoogle}
        className={`google-map ${usingGoogle ? "google-map-visible" : ""}`}
      />

      {/* 5. TACTICAL RESPONSE SQUADS OVERLAY BADGES */}
      {filterSquads && TACTICAL_EMERGENCIES.filter((e) => e.type === "squad").map((unit) => {
        const [x, y] = project(unit.point);
        if (x < -60 || x > size.width + 60 || y < -40 || y > size.height + 40) return null;
        return (
          <div
            key={unit.id}
            className={`tp-tactical-unit tp-squad-${unit.theme}`}
            style={{ left: `${x}px`, top: `${y}px` }}
            onClick={() => handleSelectEmergency(unit)}
            role="button"
            tabIndex={0}
            title={unit.title}
          >
            <div className="tp-tactical-pill">
              <span className="unit-icon">{unit.icon}</span>
              <strong>{unit.badgeText?.replace(unit.icon, "").trim()}</strong>
            </div>
            <div className="tp-tactical-stem" />
            <div className="tp-tactical-dot" />
          </div>
        );
      })}

      {/* 6. HAZARD MARKERS OVERLAY (⚠️, 🔥, 🌊) */}
      {TACTICAL_EMERGENCIES.filter((e) => e.type === "hazard").map((hazard) => {
        if (hazard.subType === "fire" && !filterThermal) return null;
        if (hazard.subType === "wave" && !filterRadar) return null;
        const [x, y] = project(hazard.point);
        if (x < -40 || x > size.width + 40 || y < -40 || y > size.height + 40) return null;
        return (
          <div
            key={hazard.id}
            className={`tp-hazard-pin tp-hazard-${hazard.theme}`}
            style={{ left: `${x}px`, top: `${y}px` }}
            onClick={() => handleSelectEmergency(hazard)}
            role="button"
            tabIndex={0}
            title={hazard.title}
          >
            <span className="tp-hazard-pulse-ring" />
            <span className="tp-hazard-icon">{hazard.icon}</span>
          </div>
        );
      })}

      {/* 7. MAP NAVIGATION ZOOM BUTTONS */}
      <div className="map-controls" aria-label="Map controls">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(1)}><Plus size={17} /></button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(-1)}><Minus size={17} /></button>
        <button type="button" aria-label="Recenter map" title="Recenter map" onClick={recenter}><Crosshair size={16} /></button>
        {onLayers && <button type="button" aria-label="Map layers" title="Map layers" onClick={onLayers}><Layers3 size={16} /></button>}
        {allowTilt && !usingGoogle && (
          <button
            type="button"
            aria-label="Tilt map"
            aria-pressed={tilt}
            title={tilt ? "Return to flat map" : "Tilt the terrain map"}
            onClick={() => setTilt(!tilt)}
          >
            <Box size={16} />
          </button>
        )}
      </div>

      {/* 8. SCALE BAR */}
      {!usingGoogle && (
        <div className="map-scale" aria-label={`Map scale ${scaleKm} kilometers`}>
          <span style={{ width: scaleKm / kmPerPixel }} /> <span>{scaleKm} km</span>
        </div>
      )}

      {/* 9. BOTTOM TELEMETRY HUD BAR */}
      <div className="map-hud-bar" role="status" aria-label="Satellite Telemetry HUD">
        <div className="hud-col hud-mgrs">
          <span className="hud-badge-tag">43Q</span>
          <span className="hud-mgrs-text">
            <Crosshair size={11} className="hud-cyan-icon" /> MGRS: <strong>6636 2965</strong>
          </span>
        </div>

        <div className="hud-sep" />

        <div className="hud-col hud-coords">
          <div className="hud-coord-line">LAT: <strong>{currentLat}°</strong></div>
          <div className="hud-coord-line">LNG: <strong>{currentLng}°</strong></div>
        </div>

        <div className="hud-sep" />

        <div className="hud-col hud-satellite">
          <span className="hud-sat-title">{offline ? "NAVIC + LORA MESH" : "SENTINEL-2 / EOS-06"}</span>
          <span className="hud-sat-status">
            <span className={offline ? "tp-glow-dot-amber" : "hud-green-dot"} style={{ width: 6, height: 6 }} />{" "}
            {offline ? "OFFLINE MESH: 865.2 MHz" : "MULTISPECTRAL FEED: ONLINE"}
          </span>
        </div>

        <div className="hud-sep" />

        <div className="hud-col hud-clocks">
          <span className="hud-zulu">
            <Clock size={11} className="hud-clock-icon" /> ZULU: <strong>{clocks.zulu} UTC</strong>
          </span>
          <span className="hud-ist">
            | <strong>{clocks.ist} IST</strong>
          </span>
        </div>
      </div>
    </div>
  );
}
