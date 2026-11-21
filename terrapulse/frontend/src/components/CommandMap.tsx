"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  SOSPacket,
  DispatchVector,
} from "@/lib/terrapulseClient";
import {
  CloudRain,
  Waves,
  Route,
  ShieldCheck,
  Building2,
  Radio,
  Plus,
  Minus,
  RotateCcw,
  AlertTriangle,
  Send,
  Info,
  Layers,
  Crosshair,
  Compass,
} from "lucide-react";

interface CommandMapProps {
  features?: GeoJsonFeatureCollection;
  sosPackets?: SOSPacket[];
  dispatches?: DispatchVector[];
  activeLayers: {
    mosdac_rain: boolean;
    bhoonidhi_flood: boolean;
    vedas_roads: boolean;
    vedas_corridors: boolean;
    bhuvan_assets: boolean;
    sos_mesh: boolean;
  };
  onToggleLayer: (layerKey: string) => void;
  onSelectFeature?: (item: any) => void;
  selectedItem?: any;
  onDispatchCorridor?: (corridorFeature: any) => void;
}

// Bounding box for Kothri Kalan / Sehore / Bhopal basin
const BASIN_BBOX = {
  minLng: 77.00,
  maxLng: 77.44,
  minLat: 23.06,
  maxLat: 23.28,
};

export default function CommandMap({
  features,
  sosPackets = [],
  dispatches = [],
  activeLayers,
  onToggleLayer,
  onSelectFeature,
  selectedItem,
  onDispatchCorridor,
}: CommandMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState({ width: 1000, height: 600 });
  const [hoveredItem, setHoveredItem] = useState<{ item: any; x: number; y: number } | null>(null);
  const [showLayerMenu, setShowLayerMenu] = useState(true);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewBox({
          width: containerRef.current.clientWidth || 1000,
          height: containerRef.current.clientHeight || 600,
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    return () => window.removeEventListener("resize", updateSize);
  }, []);

  // Coordinate Projection: [lng, lat] to SVG [x, y]
  const project = (lng: number, lat: number) => {
    const lngSpan = BASIN_BBOX.maxLng - BASIN_BBOX.minLng;
    const latSpan = BASIN_BBOX.maxLat - BASIN_BBOX.minLat;

    const normX = (lng - BASIN_BBOX.minLng) / lngSpan;
    const normY = 1.0 - (lat - BASIN_BBOX.minLat) / latSpan;

    const pad = 54;
    const mapW = viewBox.width - pad * 2;
    const mapH = viewBox.height - pad * 2;

    const rawX = pad + normX * mapW;
    const rawY = pad + normY * mapH;

    const centerX = viewBox.width / 2;
    const centerY = viewBox.height / 2;

    const finalX = (rawX - centerX) * zoom + centerX + pan.x;
    const finalY = (rawY - centerY) * zoom + centerY + pan.y;

    return [finalX, finalY];
  };

  const polygonToPath = (coords: number[][][]) => {
    if (!coords || !coords[0]) return "";
    return (
      coords[0]
        .map((pt, i) => {
          const [x, y] = project(pt[0], pt[1]);
          return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(" ") + " Z"
    );
  };

  const lineToPath = (coords: number[][]) => {
    if (!coords) return "";
    return coords
      .map((pt, i) => {
        const [x, y] = project(pt[0], pt[1]);
        return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  const resetView = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    setHoveredItem(null);
  };

  const featureList = features?.features || [];

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#050811] overflow-hidden select-none cursor-crosshair border border-slate-800"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setHoveredItem(null);
      }}
    >
      {/* Precision Cartographic Grid Lines */}
      <svg className="w-full h-full absolute inset-0">
        <defs>
          <pattern id="grid-fine" width="30" height="30" patternUnits="userSpaceOnUse">
            <path d="M 30 0 L 0 0 0 30" fill="none" stroke="rgba(255, 255, 255, 0.03)" strokeWidth="0.8" />
          </pattern>
          <pattern id="rain-diag" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="8" stroke="#38bdf8" strokeWidth="1" strokeOpacity="0.4" />
          </pattern>
          <pattern id="flood-hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
            <line x1="0" y1="0" x2="0" y2="10" stroke="#2563eb" strokeWidth="1.2" strokeOpacity="0.5" />
          </pattern>
        </defs>

        <rect width="100%" height="100%" fill="url(#grid-fine)" />

        {/* Lat / Long Coordinates Ticks */}
        <g className="text-slate-500 font-mono text-[9px] pointer-events-none">
          {[23.10, 23.15, 23.20, 23.25].map((lat) => {
            const [, y] = project(BASIN_BBOX.minLng, lat);
            return (
              <g key={`lat-${lat}`}>
                <line x1="0" y1={y} x2={viewBox.width} y2={y} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" />
                <text x="8" y={y - 3} fill="#64748b" className="tabular-data">
                  {lat.toFixed(2)}°N
                </text>
              </g>
            );
          })}
          {[77.05, 77.15, 77.25, 77.35].map((lng) => {
            const [x] = project(lng, BASIN_BBOX.minLat);
            return (
              <g key={`lng-${lng}`}>
                <line x1={x} y1="0" x2={x} y2={viewBox.height} stroke="rgba(255,255,255,0.06)" strokeDasharray="2 4" />
                <text x={x + 3} y={viewBox.height - 8} fill="#64748b" className="tabular-data">
                  {lng.toFixed(2)}°E
                </text>
              </g>
            );
          })}
        </g>

        {/* LAYER 1: MOSDAC Rain Polygons (Precipitation >=15 mm/hr) */}
        {activeLayers.mosdac_rain &&
          featureList
            .filter((f) => f.properties.layer === "mosdac_rain")
            .map((f) => {
              const pathStr = polygonToPath(f.geometry.coordinates);
              const isBreached = (f.properties.rainfall_mm_hr || 0) >= 15.0;
              const isSelected = selectedItem?.id === f.id;

              return (
                <g
                  key={f.id || "mosdac-rain"}
                  className="cursor-pointer"
                  onClick={() => onSelectFeature?.(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <path
                    d={pathStr}
                    fill="url(#rain-diag)"
                    stroke={isBreached ? "#ef4444" : "#0ea5e9"}
                    strokeWidth={isSelected ? 2.5 : isBreached ? 1.8 : 1.0}
                    strokeDasharray={isBreached ? "5 3" : undefined}
                  />
                  <path
                    d={pathStr}
                    fill={isBreached ? "rgba(239, 68, 68, 0.12)" : "rgba(14, 165, 233, 0.08)"}
                  />
                </g>
              );
            })}

        {/* LAYER 2: Bhoonidhi SAR Flood Polygons (EOS-04 Extracted Inundation) */}
        {activeLayers.bhoonidhi_flood &&
          featureList
            .filter((f) => f.properties.layer === "bhoonidhi_flood")
            .map((f) => {
              const pathStr = polygonToPath(f.geometry.coordinates);
              const isDeep = (f.properties.water_depth_m || 0) >= 0.8;
              const isSelected = selectedItem?.id === f.id;

              return (
                <g
                  key={f.id || "bhoonidhi-flood"}
                  className="cursor-pointer"
                  onClick={() => onSelectFeature?.(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <path
                    d={pathStr}
                    fill="url(#flood-hatch)"
                    stroke={isDeep ? "#dc2626" : "#2563eb"}
                    strokeWidth={isSelected ? 3.0 : isDeep ? 2.2 : 1.4}
                  />
                  <path
                    d={pathStr}
                    fill={isDeep ? "rgba(220, 38, 38, 0.22)" : "rgba(37, 99, 235, 0.16)"}
                  />
                </g>
              );
            })}

        {/* LAYER 3: VEDAS Roads (Submerged vs Passable) */}
        {activeLayers.vedas_roads &&
          featureList
            .filter((f) => f.properties.layer === "vedas_roads")
            .map((f) => {
              const pathStr = lineToPath(f.geometry.coordinates);
              const isSubmerged = f.properties.road_status === "SUBMERGED";
              const isSelected = selectedItem?.id === f.id;

              return (
                <g
                  key={f.id || "vedas-road"}
                  className="cursor-pointer"
                  onClick={() => onSelectFeature?.(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Road Casing */}
                  <path
                    d={pathStr}
                    fill="none"
                    stroke="#020617"
                    strokeWidth={isSelected ? 8 : 5}
                    strokeLinecap="round"
                  />
                  {/* Road Centerline */}
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={isSubmerged ? "#ef4444" : "#38bdf8"}
                    strokeWidth={isSubmerged ? 2.5 : 2.0}
                    strokeDasharray={isSubmerged ? "4 3" : undefined}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

        {/* LAYER 4: VEDAS Dry Evacuation Corridors (High Elevation Cartosat DEM) */}
        {activeLayers.vedas_corridors &&
          featureList
            .filter((f) => f.properties.layer === "vedas_corridors")
            .map((f) => {
              const pathStr = lineToPath(f.geometry.coordinates);
              const isSelected = selectedItem?.id === f.id;

              return (
                <g
                  key={f.id || "vedas-corridor"}
                  className="cursor-pointer"
                  onClick={() => onSelectFeature?.(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <path
                    d={pathStr}
                    fill="none"
                    stroke="#020617"
                    strokeWidth={isSelected ? 9 : 6}
                    strokeLinecap="round"
                  />
                  <path
                    d={pathStr}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={isSelected ? 3.5 : 2.4}
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

        {/* Active Broadcast Evacuation Dispatches */}
        {dispatches.map((disp) => {
          if (disp.evacuation_corridor?.coordinates) {
            const pathStr = lineToPath(disp.evacuation_corridor.coordinates);
            return (
              <path
                key={disp.dispatch_id}
                d={pathStr}
                fill="none"
                stroke="#06b6d4"
                strokeWidth={3}
                strokeDasharray="6 4"
                strokeLinecap="round"
              />
            );
          }
          return null;
        })}

        {/* LAYER 6: Tactical LoRa 865 MHz Mesh Relay Hops */}
        {activeLayers.sos_mesh &&
          sosPackets.map((sos) => {
            const [sosX, sosY] = project(sos.position.lng, sos.position.lat);
            const [baseX, baseY] = project(77.0160, 23.0805); // VIT Shelter / Command Base
            return (
              <line
                key={`mesh-hop-${sos.sos_id}`}
                x1={sosX}
                y1={sosY}
                x2={baseX}
                y2={baseY}
                stroke="#d97706"
                strokeWidth={1.2}
                strokeDasharray="3 3"
                strokeOpacity={0.75}
              />
            );
          })}

        {/* LAYER 5: Bhuvan Infrastructure Cadastral Asset Markers */}
        {activeLayers.bhuvan_assets &&
          featureList
            .filter((f) => f.properties.layer === "bhuvan_assets")
            .map((f) => {
              const [x, y] = project(f.geometry.coordinates[0], f.geometry.coordinates[1]);
              const assetType = f.properties.asset_type;
              const isSelected = selectedItem?.id === f.id;

              return (
                <g
                  key={f.id || `asset-${x}-${y}`}
                  transform={`translate(${x}, ${y})`}
                  className="cursor-pointer"
                  onClick={() => onSelectFeature?.(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Selection Reticle */}
                  {isSelected && (
                    <circle r={14} fill="none" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="3 2" />
                  )}

                  {/* High-contrast tactile marker */}
                  <rect
                    x="-6"
                    y="-6"
                    width="12"
                    height="12"
                    fill={
                      assetType === "SHELTER"
                        ? "#059669"
                        : assetType === "HOSPITAL"
                        ? "#dc2626"
                        : assetType === "RESERVOIR"
                        ? "#0284c7"
                        : "#475569"
                    }
                    stroke="#ffffff"
                    strokeWidth="1.2"
                  />

                  {/* Label */}
                  <text
                    x="9"
                    y="3"
                    fill="#cbd5e1"
                    fontSize="9"
                    fontFamily="monospace"
                    className="pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                  >
                    {f.properties.title.split("(")[0].trim().slice(0, 16)}
                  </text>
                </g>
              );
            })}

        {/* Live SOS Distress Beacons */}
        {activeLayers.sos_mesh &&
          sosPackets.map((sos) => {
            const [x, y] = project(sos.position.lng, sos.position.lat);
            const isCrit = sos.triage.severity === "CRITICAL";
            const isSelected = selectedItem?.sos_id === sos.sos_id;

            return (
              <g
                key={sos.sos_id}
                transform={`translate(${x}, ${y})`}
                className="cursor-pointer"
                onClick={() => onSelectFeature?.(sos)}
                onMouseEnter={(e) => setHoveredItem({ item: sos, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                {/* Radar Ripple */}
                <circle
                  r={isCrit ? 16 : 12}
                  fill="none"
                  stroke={isCrit ? "#ef4444" : "#f59e0b"}
                  strokeWidth={1.2}
                  className="animate-ping opacity-60"
                />
                {isSelected && (
                  <circle r={18} fill="none" stroke="#38bdf8" strokeWidth={1.5} strokeDasharray="3 2" />
                )}

                {/* Tactile Beacon Square */}
                <polygon
                  points="0,-8 7,5 -7,5"
                  fill={isCrit ? "#ef4444" : "#f59e0b"}
                  stroke="#ffffff"
                  strokeWidth="1"
                />

                <text
                  x="10"
                  y="2"
                  fill="#fca5a5"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="bold"
                  className="pointer-events-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]"
                >
                  {sos.sos_id} ({sos.triage.headcount}p)
                </text>
              </g>
            );
          })}
      </svg>

      {/* Basin Coordinates & Datum Indicator (Top Left) */}
      <div className="absolute top-3 left-3 pointer-events-none bg-slate-950/90 border border-slate-800 px-3 py-1.5 rounded text-[11px] font-mono text-slate-300 flex items-center space-x-2">
        <Compass className="w-3.5 h-3.5 text-cyan-400" />
        <span>KOTHRI-SEHORE-BHOPAL BASIN</span>
        <span className="text-slate-500">|</span>
        <span className="tabular-data text-slate-400">23.18°N 77.20°E · WGS84</span>
      </div>

      {/* Floating Tactical Hover Tooltip */}
      {hoveredItem && (
        <div
          className="absolute z-30 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2"
          style={{
            left: Math.min(Math.max(hoveredItem.x - (containerRef.current?.getBoundingClientRect().left || 0), 90), viewBox.width - 90),
            top: Math.max(hoveredItem.y - (containerRef.current?.getBoundingClientRect().top || 0) - 8, 28),
          }}
        >
          <div className="bg-[#0b1120] border border-slate-700 p-2 rounded shadow-xl text-xs space-y-1 font-mono max-w-xs">
            {hoveredItem.item.sos_id ? (
              <div>
                <div className="flex justify-between items-center text-rose-400 font-bold text-[11px]">
                  <span>{hoveredItem.item.sos_id}</span>
                  <span className="text-[10px] px-1 bg-rose-950 border border-rose-800 rounded">{hoveredItem.item.triage.severity}</span>
                </div>
                <div className="text-slate-300 text-[10px] font-sans mt-0.5 line-clamp-1">{hoveredItem.item.triage.note}</div>
                <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/80">
                  <span>Headcount: {hoveredItem.item.triage.headcount}</span>
                  <span>Mesh: {hoveredItem.item.mesh.hop_count} hops</span>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex justify-between items-center text-slate-200 font-bold text-[11px]">
                  <span className="truncate">{hoveredItem.item.properties?.title}</span>
                  <span className="text-[9px] uppercase px-1 bg-slate-800 text-cyan-400 rounded ml-1">
                    {hoveredItem.item.properties?.layer?.replace("_", " ")}
                  </span>
                </div>
                <div className="text-[10px] text-slate-400 font-sans mt-0.5 line-clamp-1">
                  {hoveredItem.item.properties?.recommended_action}
                </div>
                <div className="text-[10px] text-slate-400 flex justify-between pt-1 border-t border-slate-800/80">
                  {hoveredItem.item.properties?.rainfall_mm_hr > 0 && (
                    <span>Rain: {hoveredItem.item.properties.rainfall_mm_hr} mm/h</span>
                  )}
                  {hoveredItem.item.properties?.water_depth_m > 0 && (
                    <span className="text-rose-400">Depth: {hoveredItem.item.properties.water_depth_m}m</span>
                  )}
                  {hoveredItem.item.properties?.elevation_m && (
                    <span>Elev: {hoveredItem.item.properties.elevation_m}m</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Floating Selected GIS Feature Attribute Inspector Card */}
      {selectedItem && (
        <div className="absolute top-3 right-3 z-20 w-80 max-w-[calc(100%-2rem)] bg-[#0b1120] border border-slate-700 rounded-lg p-3 shadow-2xl text-xs space-y-2">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
            <span className="text-[10px] font-mono font-bold tracking-wider text-cyan-400 uppercase">
              {selectedItem.sos_id ? "DISTRESS PACKET TELEMETRY" : "GIS ATTRIBUTE INSPECTION"}
            </span>
            <button
              onClick={() => onSelectFeature?.(null)}
              className="text-slate-400 hover:text-white text-xs px-1"
            >
              ✕
            </button>
          </div>

          {selectedItem.sos_id ? (
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex justify-between items-center font-bold">
                <span className="text-white">{selectedItem.sos_id}</span>
                <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                  selectedItem.triage.severity === "CRITICAL" ? "bg-rose-950 text-rose-300 border border-rose-800" : "bg-amber-950 text-amber-300"
                }`}>
                  {selectedItem.triage.severity}
                </span>
              </div>
              <p className="text-slate-300 font-sans text-xs bg-slate-900/80 p-2 rounded border border-slate-800">
                &quot;{selectedItem.triage.note}&quot;
              </p>
              <div className="grid grid-cols-2 gap-1 text-slate-400 text-[10px] pt-1">
                <div>Pax: <strong className="text-white">{selectedItem.triage.headcount}</strong></div>
                <div>NavIC: <strong className="text-emerald-400">{selectedItem.position.navic_band}</strong></div>
                <div>Mesh: <strong className="text-amber-400">{selectedItem.mesh.transport}</strong></div>
                <div>Hops: <strong className="text-white">{selectedItem.mesh.hop_count}</strong></div>
              </div>
              <div className="text-[10px] text-slate-400 pt-1">
                Needs: {selectedItem.triage.needs.join(", ")}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-xs">
              <div className="font-bold text-white text-[13px]">{selectedItem.properties?.title}</div>
              <div className="flex gap-1.5 text-[10px] font-mono">
                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                  {selectedItem.properties?.layer?.replace("_", " ").toUpperCase()}
                </span>
                <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded border border-slate-700">
                  SEV: {selectedItem.properties?.severity}
                </span>
                {selectedItem.properties?.road_status && selectedItem.properties.road_status !== "NA" && (
                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                    selectedItem.properties.road_status === "SUBMERGED"
                      ? "bg-rose-900/60 text-rose-300 border border-rose-700"
                      : "bg-emerald-900/60 text-emerald-300 border border-emerald-700"
                  }`}>
                    {selectedItem.properties.road_status}
                  </span>
                )}
              </div>

              <div className="bg-slate-900/80 p-2 rounded border border-slate-800 text-[11px] text-slate-300">
                {selectedItem.properties?.recommended_action}
              </div>

              <table className="w-full data-table text-[10px] font-mono">
                <tbody>
                  {selectedItem.properties?.elevation_m && (
                    <tr>
                      <td className="text-slate-400">Elevation:</td>
                      <td className="text-right text-white tabular-data">{selectedItem.properties.elevation_m}m AMSL</td>
                    </tr>
                  )}
                  {selectedItem.properties?.water_depth_m > 0 && (
                    <tr>
                      <td className="text-slate-400">Flood Depth:</td>
                      <td className="text-right text-rose-400 tabular-data">{selectedItem.properties.water_depth_m}m</td>
                    </tr>
                  )}
                  {selectedItem.properties?.rainfall_mm_hr > 0 && (
                    <tr>
                      <td className="text-slate-400">Rain Intensity:</td>
                      <td className="text-right text-cyan-400 tabular-data">{selectedItem.properties.rainfall_mm_hr} mm/h</td>
                    </tr>
                  )}
                  {selectedItem.properties?.capacity && (
                    <tr>
                      <td className="text-slate-400">Shelter Capacity:</td>
                      <td className="text-right text-emerald-400 tabular-data">{selectedItem.properties.capacity} persons</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {/* Action Button: Broadcast Ridge Corridor */}
              {(selectedItem.properties?.layer === "vedas_corridors" || selectedItem.properties?.road_status === "CORRIDOR" || selectedItem.properties?.layer === "bhoonidhi_flood") && (
                <button
                  onClick={() => onDispatchCorridor?.(selectedItem)}
                  className="w-full mt-2 py-1 px-2.5 rounded bg-emerald-700 hover:bg-emerald-600 text-white font-mono text-xs font-semibold flex items-center justify-center space-x-1.5 transition"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Broadcast Vector to Field Mesh</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tactical Map Zoom Controls (Bottom Right) */}
      <div className="absolute bottom-3 right-3 flex flex-col space-y-1 bg-[#0b1120] border border-slate-800 p-1 rounded z-10 shadow-lg">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.25, 3.0))}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition"
          title="Zoom In"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.6))}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition"
          title="Zoom Out"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={resetView}
          className="p-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded transition"
          title="Reset Extents"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Layer Control Bar (Bottom Left) */}
      <div className="absolute bottom-3 left-3 flex items-center space-x-1.5 bg-[#0b1120]/95 border border-slate-800 px-2.5 py-1.5 rounded text-[11px] font-mono z-10 overflow-x-auto max-w-[calc(100%-6rem)]">
        <span className="text-[9px] uppercase tracking-wider text-slate-500 mr-1 flex-shrink-0 font-bold">
          LAYERS:
        </span>

        <button
          onClick={() => onToggleLayer("mosdac_rain")}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded transition flex-shrink-0 ${
            activeLayers.mosdac_rain
              ? "bg-cyan-950/70 text-cyan-300 border border-cyan-700/60 font-semibold"
              : "text-slate-500 hover:text-slate-300 border border-transparent"
          }`}
        >
          <CloudRain className="w-3 h-3" />
          <span>MOSDAC</span>
        </button>

        <button
          onClick={() => onToggleLayer("bhoonidhi_flood")}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded transition flex-shrink-0 ${
            activeLayers.bhoonidhi_flood
              ? "bg-blue-950/70 text-blue-300 border border-blue-700/60 font-semibold"
              : "text-slate-500 hover:text-slate-300 border border-transparent"
          }`}
        >
          <Waves className="w-3 h-3" />
          <span>BHOONIDHI SAR</span>
        </button>

        <button
          onClick={() => onToggleLayer("vedas_roads")}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded transition flex-shrink-0 ${
            activeLayers.vedas_roads
              ? "bg-rose-950/70 text-rose-300 border border-rose-700/60 font-semibold"
              : "text-slate-500 hover:text-slate-300 border border-transparent"
          }`}
        >
          <Route className="w-3 h-3" />
          <span>ROADS</span>
        </button>

        <button
          onClick={() => onToggleLayer("vedas_corridors")}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded transition flex-shrink-0 ${
            activeLayers.vedas_corridors
              ? "bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-semibold"
              : "text-slate-500 hover:text-slate-300 border border-transparent"
          }`}
        >
          <ShieldCheck className="w-3 h-3" />
          <span>DRY CORRIDORS</span>
        </button>

        <button
          onClick={() => onToggleLayer("bhuvan_assets")}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded transition flex-shrink-0 ${
            activeLayers.bhuvan_assets
              ? "bg-slate-800 text-slate-200 border border-slate-600 font-semibold"
              : "text-slate-500 hover:text-slate-300 border border-transparent"
          }`}
        >
          <Building2 className="w-3 h-3" />
          <span>BHUVAN ASSETS</span>
        </button>

        <button
          onClick={() => onToggleLayer("sos_mesh")}
          className={`flex items-center space-x-1 px-2 py-0.5 rounded transition flex-shrink-0 ${
            activeLayers.sos_mesh
              ? "bg-amber-950/70 text-amber-300 border border-amber-700/60 font-semibold"
              : "text-slate-500 hover:text-slate-300 border border-transparent"
          }`}
        >
          <Radio className="w-3 h-3" />
          <span>LORA 865 MHz</span>
        </button>
      </div>
    </div>
  );
}
