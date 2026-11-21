"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { Crosshair, Layers3, Minus, Plus, Radar } from "lucide-react";
import basemap from "@/lib/india-basemap.json";
import { loadGoogleMaps, onGoogleAuthFailure, HAS_GOOGLE_MAPS, type GoogleMap, type MapStyle } from "@/lib/googleMaps";
import { INDIA, INDIA_REGIONS, inBounds, type Bounds, type Point, type Region } from "@/lib/regions";
import {
  featurePoint, featureRegion, type DispatchVector, type GeoJsonFeature, type GeoJsonGeometry, type SOSPacket,
} from "@/lib/terrapulseClient";
import { mapColor, type ActiveLayers } from "@/lib/layers";

export interface MapTarget {
  center: Point;
  zoom: number;
  bbox?: Bounds;
  label: string;
}
export type MapSelection = GeoJsonFeature | SOSPacket;

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
  location?: Point;
}

interface Dimensions { width: number; height: number }
interface View { center: Point; scale: number }
interface Marker {
  id: string; label: string; point: Point; color: string; pulse?: boolean;
  shape?: "asset" | "sos"; select?: () => void; offset?: Point;
}

const MODES = [
  { key: "satellite", label: "Satellite" },
  { key: "hybrid", label: "Hybrid" },
  { key: "roadmap", label: "Map" },
] as const;
const SOS_COLOR = "#FF6868";
const ROUTE_COLOR = "#F5D547";
const PULSE_COLOR = "#FF8A3D";
const REGION_LABEL_ANCHORS: Partial<Record<string, "start" | "end">> = {
  "central-india": "end",
  "indo-gangetic": "end",
  "northeast-india": "start",
};
const LOCAL_PLACES = [
  { name: "NEW DELHI", point: [77.209, 28.614] },
  { name: "KOLKATA", point: [88.364, 22.573] },
  { name: "HYDERABAD", point: [78.487, 17.385] },
] as const;

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
  onSelect, onRegion, onPoint, onLayers, location,
}: Props) {
  const shell = useRef<HTMLDivElement>(null);
  const googleHost = useRef<HTMLDivElement>(null);
  const googleMap = useRef<GoogleMap>();
  const [size, setSize] = useState<Dimensions>({ width: 840, height: 450 });
  const [mapStyle, setMapStyle] = useState<MapStyle>("satellite");
  const [googleStatus, setGoogleStatus] = useState<"idle" | "loading" | "ready" | "fallback">("idle");
  const [view, setView] = useState<View>(() => ({ center: target.center, scale: scaleFor(target, size) }));
  const currentView = useRef(view);
  const animation = useRef<number>();
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ x: number; y: number; center: Point; scale: number; moved: boolean }>();
  const selectItem = useRef(onSelect);
  const currentTarget = useRef(target);
  const currentStyle = useRef(mapStyle);
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
  const routes = activeLayers.vedas_corridors ? dispatches : [];
  const usingGoogle = googleStatus === "ready" && !offline;

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
  const national = view.scale <= 23;
  const showLabels = mapStyle !== "satellite" || national;
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
    const location = region.places[0]?.center ?? region.center;
    const nudge: Point = region.id === "arid-belt" ? [73.0243, 26.2389] : location;
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

  const kmPerPixel = 111.32 / Math.max(1, view.scale);
  const scaleKm = [1000, 500, 250, 100, 50, 25, 10, 5, 2, 1].find((km) => km / kmPerPixel <= 106) ?? .5;
  const googleBadge = usingGoogle ? "Google Maps" : googleStatus === "loading" ? "Loading Google Maps…" : (
    mapStyle === "roadmap" ? "Local vector map" : "Bundled satellite terrain"
  );
  const gridStep = national ? 5 : view.scale < 150 ? 1 : .1;
  const firstLongitude = Math.ceil((view.center[0] - size.width / 2 / sx) / gridStep) * gridStep;
  const firstLatitude = Math.ceil((view.center[1] - size.height / 2 / view.scale) / gridStep) * gridStep;
  const longitudes = Array.from({ length: Math.ceil(size.width / sx / gridStep) }, (_, index) => firstLongitude + index * gridStep);
  const latitudes = Array.from({ length: Math.ceil(size.height / view.scale / gridStep) }, (_, index) => firstLatitude + index * gridStep);

  return (
    <div className="map-canvas" ref={shell} aria-label={`Interactive map of ${target.label}`}>
      <svg className={`local-map ${dragging ? "dragging" : ""}`} width="100%" height="100%"
        viewBox={`0 0 ${size.width} ${size.height}`} role="group" aria-label="India map and map markers"
        onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={stopDrag} onPointerCancel={stopDrag}>
        <defs>
          <radialGradient id="map-vignette"><stop offset="45%" stopColor="#030916" stopOpacity="0" /><stop offset="100%" stopColor="#030916" stopOpacity=".28" /></radialGradient>
        </defs>
        <rect width={size.width} height={size.height} fill="var(--map-sea)" />
        {mapStyle !== "roadmap" && (
          <image href="/india-terrain.webp" x={pictureX} y={pictureY}
            width={(boundsForImage[2] - boundsForImage[0]) * sx}
            height={(boundsForImage[3] - boundsForImage[1]) * view.scale} preserveAspectRatio="none" />
        )}
        <g transform={`matrix(${sx} 0 0 ${-view.scale} ${ox} ${oy})`} pointerEvents="none">
          {borderPaths.map(({ path, india }, index) => <path key={index} d={path}
            fill={mapStyle === "roadmap" ? india ? "var(--map-land)" : "var(--map-neighbor)" : "none"}
            stroke={india ? "var(--map-border)" : "var(--map-border-muted)"}
            strokeWidth={india ? 1.05 : .55} strokeOpacity={mapStyle === "satellite" ? .6 : .95} vectorEffect="non-scaling-stroke" />)}
        </g>
        <g className="map-grid" pointerEvents="none" aria-hidden="true">
          {longitudes.map((lng) => { const [x] = project([lng, 0]); return <line key={lng} x1={x} x2={x} y1="0" y2={size.height} />; })}
          {latitudes.map((lat) => { const [, y] = project([0, lat]); return <line key={lat} x1="0" x2={size.width} y1={y} y2={y} />; })}
        </g>
        {national && (
          <g className="map-geography" aria-hidden="true" pointerEvents="none">
            <text x={project([81.5, 23.1])[0]} y={project([81.5, 23.1])[1]} className="map-country" textAnchor="middle">INDIA</text>
            <text x={project([67.3, 12.9])[0]} y={project([67.3, 12.9])[1]} textAnchor="middle" className="map-sea-label">Arabian Sea</text>
            <text x={project([88.5, 14.3])[0]} y={project([88.5, 14.3])[1]} textAnchor="middle" className="map-sea-label">Bay of Bengal</text>
            {showLabels && LOCAL_PLACES.map(({ name, point }) => {
              const [x, y] = project([point[0], point[1]]);
              return <g key={name}><circle cx={x} cy={y} r="1.8" fill="currentColor" />
                <text x={x + 6} y={y + 3} className="map-city">{name}</text></g>;
            })}
          </g>
        )}
        <rect width={size.width} height={size.height} fill="url(#map-vignette)" pointerEvents="none" />
        {visible.filter(drawFeature).map((feature, index) => {
          const d = geometryPath(feature.geometry, project);
          if (!d) return null;
          const color = mapColor(feature.properties);
          const isLine = feature.geometry.type === "LineString";
          const interactive = onSelect ? () => onSelect(feature) : undefined;
          return <g key={feature.id ?? index} data-map-action="" className={interactive ? "map-feature" : undefined}
            role={interactive ? "button" : undefined} tabIndex={interactive ? 0 : undefined}
            aria-label={feature.properties.title} onClick={interactive}
            onKeyDown={interactive ? (event) => activate(event, interactive) : undefined}>
            <title>{feature.properties.title}</title>
            {isLine && <path d={d} stroke="transparent" strokeWidth="15" fill="none" />}
            <path d={d} fillRule="evenodd" fill={isLine ? "none" : color} fillOpacity={.23}
              stroke={color} strokeWidth={isLine ? 3 : 1.4} strokeOpacity={isLine ? 1 : .78}
              strokeLinecap="round" strokeDasharray={feature.properties.road_status === "CORRIDOR" ? "7 5" : undefined} />
          </g>;
        })}
        {!national && routes.map((dispatch) => <path key={dispatch.dispatch_id}
          d={geometryPath(dispatch.evacuation_corridor, project)} fill="none" stroke={ROUTE_COLOR}
          strokeWidth="3" strokeDasharray="6 5" strokeOpacity=".9" pointerEvents="none" />)}
        {markers.map(({ id, label, point, color, shape, pulse, select, offset }) => {
          const [px, py] = project(point);
          const x = px + (offset?.[0] ?? 0);
          const y = py + (offset?.[1] ?? 0);
          const anchor = REGION_LABEL_ANCHORS[id] ?? "middle";
          const labelX = anchor === "end" ? -8 : anchor === "start" ? 8 : 0;
          if (x < -42 || x > size.width + 42 || y < -42 || y > size.height + 42) return null;
          return <g key={id} transform={`translate(${x},${y})`} data-map-action=""
            className={select ? "map-feature" : undefined} role={select ? "button" : undefined}
            tabIndex={select ? 0 : undefined} aria-label={label} onClick={select}
            onKeyDown={select ? (event) => activate(event, select) : undefined}>
            <title>{label}</title>
            <circle r="14" fill="transparent" />
            {pulse && <circle r={national ? "15" : "13"} fill={color} opacity=".22" />}
            <circle r={national ? "7" : "6"} fill={color} fillOpacity=".94" stroke="#0B1220" strokeWidth="2" />
            {shape === "asset" && <path d="M-2.7 0 H2.7 M0 -2.7 V2.7" stroke="#15132a" strokeWidth="1.6" />}
            {shape === "sos" && <path d="M0 -2.7 V.6 M0 2.5 v.3" stroke="#441019" strokeWidth="1.7" strokeLinecap="round" />}
            {(national && size.width > 480 && shape !== "sos" || id === "location") && (
              <text x={labelX} y={-13} textAnchor={anchor} className="map-marker-label">{label}</text>
            )}
          </g>;
        })}
      </svg>
      <div ref={googleHost} aria-hidden={!usingGoogle}
        className={`google-map ${usingGoogle ? "google-map-visible" : ""}`} />
      <div className="map-source"><Radar size={14} aria-hidden /> {googleBadge}</div>
      <div className="map-types" role="group" aria-label="Map view">
        {MODES.map(({ key, label }) => <button key={key} type="button" aria-pressed={mapStyle === key}
          onClick={() => setMapStyle(key)}>{label}</button>)}
      </div>
      <div className="map-controls" aria-label="Map controls">
        <button type="button" aria-label="Zoom in" title="Zoom in" onClick={() => zoom(1)}><Plus size={17} /></button>
        <button type="button" aria-label="Zoom out" title="Zoom out" onClick={() => zoom(-1)}><Minus size={17} /></button>
        <button type="button" aria-label="Recenter map" title="Recenter map" onClick={recenter}><Crosshair size={16} /></button>
        {onLayers && <button type="button" aria-label="Map layers" title="Map layers" onClick={onLayers}><Layers3 size={16} /></button>}
      </div>
      {!usingGoogle && <div className="map-scale" aria-label={`Map scale ${scaleKm} kilometers`}>
        <span style={{ width: scaleKm / kmPerPixel }} /> <span>{scaleKm} km</span>
      </div>}
      {!usingGoogle && <div className="map-credit">{mapStyle === "roadmap" ? "Natural Earth" : "NASA Blue Marble · Natural Earth"}</div>}
    </div>
  );
}
