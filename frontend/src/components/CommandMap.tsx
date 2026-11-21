"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  SOSPacket,
  DispatchVector,
} from "@/lib/terrapulseClient";
import {
  Plus,
  Minus,
  Crosshair,
  Layers,
  AlertTriangle,
} from "lucide-react";

export interface CommandMapProps {
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
  isAdvancedView?: boolean;
}

// Bounding box for Kothri Kalan / Sehore / Bhopal basin
const BASIN_BBOX = {
  minLng: 77.00,
  maxLng: 77.44,
  minLat: 23.06,
  maxLat: 23.28,
};

export function CommandMap({
  features,
  sosPackets = [],
  dispatches = [],
  activeLayers,
  onToggleLayer,
  onSelectFeature,
  selectedItem,
  onDispatchCorridor,
  isAdvancedView = false,
}: CommandMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [viewBox, setViewBox] = useState({ width: 900, height: 500 });
  const [mapViewMode, setMapViewMode] = useState<"satellite" | "map">("satellite");
  const [hoveredItem, setHoveredItem] = useState<{ item: any; x: number; y: number } | null>(null);

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setViewBox({
          width: containerRef.current.clientWidth || 900,
          height: containerRef.current.clientHeight || 500,
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

    const pad = 48;
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

  const focusCoordinates = (lng: number, lat: number) => {
    const [targetX, targetY] = project(lng, lat);
    const centerX = viewBox.width / 2;
    const centerY = viewBox.height / 2;
    setPan((p) => ({
      x: p.x + (centerX - targetX) * 0.65,
      y: p.y + (centerY - targetY) * 0.65,
    }));
  };

  const handleFeatureClick = (item: any) => {
    onSelectFeature?.(item);

    if (item.sos_id && item.position) {
      focusCoordinates(item.position.lng, item.position.lat);
    } else if (item.geometry) {
      if (item.geometry.type === "Point") {
        focusCoordinates(item.geometry.coordinates[0], item.geometry.coordinates[1]);
      } else if (item.geometry.type === "LineString" && item.geometry.coordinates[0]) {
        const midIdx = Math.floor(item.geometry.coordinates.length / 2);
        focusCoordinates(item.geometry.coordinates[midIdx][0], item.geometry.coordinates[midIdx][1]);
      } else if (item.geometry.type === "Polygon" && item.geometry.coordinates[0]?.[0]) {
        focusCoordinates(item.geometry.coordinates[0][0][0], item.geometry.coordinates[0][0][1]);
      }
    }
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

  // Drag Pan Handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === "BUTTON") return;
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
    onSelectFeature?.(null);
  };

  const featureList = features?.features || [];

  // Focal Epicenter (Sevan River Crossing / Kothri Kalan)
  const [epicenterX, epicenterY] = project(77.0580, 23.0910);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full bg-[#0A101D] select-none overflow-hidden cursor-crosshair rounded-2xl"
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* SVG GIS Vector Map Surface */}
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${viewBox.width} ${viewBox.height}`}
        className="w-full h-full block"
      >
        <defs>
          {/* Topographic Contour Texture Pattern */}
          <pattern id="survey-contours" width="120" height="120" patternUnits="userSpaceOnUse">
            <path
              d="M0 20 Q 30 10, 60 25 T 120 20 M0 45 Q 40 35, 75 50 T 120 40 M0 70 Q 25 80, 60 65 T 120 75 M0 95 Q 50 85, 80 100 T 120 90"
              fill="none"
              stroke="#ffffff"
              strokeWidth="0.5"
              strokeOpacity="0.04"
              strokeDasharray="3 2"
            />
          </pattern>

          {/* Satellite Multi-Spectral Terrain Texture Pattern */}
          <radialGradient id="sat-veg-1" cx="35%" cy="40%" r="65%">
            <stop offset="0%" stopColor="#1E3321" />
            <stop offset="50%" stopColor="#142618" />
            <stop offset="100%" stopColor="#0B1710" />
          </radialGradient>
          <radialGradient id="sat-ridge-1" cx="65%" cy="30%" r="55%">
            <stop offset="0%" stopColor="#2E2A1A" />
            <stop offset="70%" stopColor="#1F1D13" />
            <stop offset="100%" stopColor="#0E1410" />
          </radialGradient>

          {/* Rain Diagonal Hatch */}
          <pattern id="rain-diag" width="12" height="12" patternTransform="rotate(45 0 0)" patternUnits="userSpaceOnUse">
            <line x1="0" y1="0" x2="0" y2="12" stroke="#5BC0FF" strokeWidth="1.2" strokeOpacity="0.35" />
          </pattern>
        </defs>

        {/* 1. Base Layer (Satellite Terrain vs Cartographic Map) */}
        {mapViewMode === "satellite" ? (
          <g>
            {/* Rich Photographic Satellite Image Base */}
            <image
              href="/sat-terrain.jpg"
              x="0"
              y="0"
              width={viewBox.width}
              height={viewBox.height}
              preserveAspectRatio="xMidYMid slice"
              className="opacity-95"
            />
            {/* Subtle multi-spectral contrast overlays */}
            <rect width={viewBox.width} height={viewBox.height} fill="url(#sat-veg-1)" opacity="0.3" pointerEvents="none" />
          </g>
        ) : (
          <g>
            <rect width={viewBox.width} height={viewBox.height} fill="#0A0F1D" />
            <rect width={viewBox.width} height={viewBox.height} fill="url(#survey-contours)" pointerEvents="none" />
          </g>
        )}

        {/* 2. Coordinate Grid Lines (Only in Advanced View or subtle in standard) */}
        <g opacity={isAdvancedView ? "0.35" : "0.15"} pointerEvents="none" className="font-mono text-[9px]">
          {[23.08, 23.14, 23.20, 23.26].map((lat) => {
            const [, y] = project(BASIN_BBOX.minLng, lat);
            return (
              <g key={`lat-${lat}`}>
                <line x1="0" y1={y} x2={viewBox.width} y2={y} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 4" />
                <text x="8" y={y - 3} fill="#94A3B8" className="tabular-nums font-mono text-[9px]">
                  {lat.toFixed(2)}°N
                </text>
              </g>
            );
          })}
          {[77.02, 77.10, 77.20, 77.30, 77.40].map((lng) => {
            const [x] = project(lng, BASIN_BBOX.minLat);
            return (
              <g key={`lng-${lng}`}>
                <line x1={x} y1="0" x2={x} y2={viewBox.height} stroke="rgba(255,255,255,0.12)" strokeDasharray="2 4" />
                <text x={x + 3} y={viewBox.height - 8} fill="#94A3B8" className="tabular-nums font-mono text-[9px]">
                  {lng.toFixed(2)}°E
                </text>
              </g>
            );
          })}
        </g>

        {/* 3. LAYER: Rain Polygons */}
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
                  className="cursor-pointer transition-opacity"
                  onClick={() => handleFeatureClick(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <path
                    d={pathStr}
                    fill="url(#rain-diag)"
                    stroke={isBreached ? "#EF4444" : "#38BDF8"}
                    strokeWidth={isSelected ? 3.0 : 1.5}
                    strokeDasharray={isBreached ? "5 3" : undefined}
                  />
                  <path
                    d={pathStr}
                    fill={isBreached ? "rgba(239, 68, 68, 0.22)" : "rgba(56, 189, 248, 0.10)"}
                  />
                </g>
              );
            })}

        {/* 4. LAYER: Flooded Areas (Prominent Red Inundation Zone) */}
        {activeLayers.bhoonidhi_flood &&
          featureList
            .filter((f) => f.properties.layer === "bhoonidhi_flood")
            .map((f) => {
              const pathStr = polygonToPath(f.geometry.coordinates);
              const isSelected = selectedItem?.id === f.id;

              return (
                <g
                  key={f.id || "bhoonidhi-flood"}
                  className="cursor-pointer"
                  onClick={() => handleFeatureClick(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <path
                    d={pathStr}
                    fill="rgba(239, 68, 68, 0.38)"
                    stroke="#EF4444"
                    strokeWidth={isSelected ? 3.2 : 2.0}
                  />
                  <path
                    d={pathStr}
                    fill="none"
                    stroke="#FFFFFF"
                    strokeWidth="0.8"
                    strokeDasharray="4 2"
                    opacity="0.6"
                  />
                </g>
              );
            })}

        {/* 5. LAYER: Road Network (Green Open vs Red Blocked) */}
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
                  onClick={() => handleFeatureClick(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <path
                    d={pathStr}
                    fill="none"
                    stroke={isSubmerged ? "#EF4444" : "#475569"}
                    strokeWidth={isSelected ? 5.0 : isSubmerged ? 4.0 : 2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  {isSubmerged && (
                    <path
                      d={pathStr}
                      fill="none"
                      stroke="#FFFFFF"
                      strokeWidth="1.2"
                      strokeDasharray="3 3"
                    />
                  )}
                </g>
              );
            })}

        {/* 6. LAYER: Safe Evacuation Roads (>510m AMSL Safe High Ground) */}
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
                  onClick={() => handleFeatureClick(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  {/* Glowing Safe Green Highway */}
                  <path
                    d={pathStr}
                    fill="none"
                    stroke="#10B981"
                    strokeWidth={isSelected ? 7.0 : 5.0}
                    strokeOpacity="0.45"
                    strokeLinecap="round"
                  />
                  <path
                    d={pathStr}
                    fill="none"
                    stroke="#34D399"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                </g>
              );
            })}

        {/* 7. LAYER: Shelters & Relief Camps (Hospitals, Relief Camps) */}
        {activeLayers.bhuvan_assets &&
          featureList
            .filter((f) => f.properties.layer === "bhuvan_assets")
            .map((f) => {
              const [px, py] = project(f.geometry.coordinates[0], f.geometry.coordinates[1]);
              const isShelter = f.properties.asset_type === "SHELTER";
              const isSelected = selectedItem?.id === f.id;

              return (
                <g
                  key={f.id || "bhuvan-asset"}
                  transform={`translate(${px}, ${py})`}
                  className="cursor-pointer"
                  onClick={() => handleFeatureClick(f)}
                  onMouseEnter={(e) => setHoveredItem({ item: f, x: e.clientX, y: e.clientY })}
                  onMouseLeave={() => setHoveredItem(null)}
                >
                  <circle
                    r={isSelected ? 10 : 8}
                    fill={isShelter ? "#10B981" : "#A78BFA"}
                    stroke="#FFFFFF"
                    strokeWidth="1.8"
                    className="shadow-sm"
                  />
                  <text
                    x="12"
                    y="3"
                    fill="#F1F5F9"
                    fontSize="9"
                    fontWeight="bold"
                    className="pointer-events-none font-sans drop-shadow"
                  >
                    {f.properties.title?.split("(")[0]}
                  </text>
                </g>
              );
            })}

        {/* 8. LAYER: Active SOS Help Signals */}
        {activeLayers.sos_mesh &&
          sosPackets.map((sos) => {
            const [px, py] = project(sos.position.lng, sos.position.lat);
            const isCrit = sos.triage.severity === "CRITICAL";
            const isSelected = selectedItem?.sos_id === sos.sos_id;

            return (
              <g
                key={sos.sos_id}
                transform={`translate(${px}, ${py})`}
                className="cursor-pointer"
                onClick={() => handleFeatureClick(sos)}
                onMouseEnter={(e) => setHoveredItem({ item: sos, x: e.clientX, y: e.clientY })}
                onMouseLeave={() => setHoveredItem(null)}
              >
                <circle r="14" fill={isCrit ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"} className="animate-ping" />
                <circle r={isSelected ? 9 : 7} fill={isCrit ? "#EF4444" : "#F59E0B"} stroke="#FFFFFF" strokeWidth="2" />
                <text
                  x="12"
                  y="3"
                  fill={isCrit ? "#FCA5A5" : "#FDE68A"}
                  fontSize="9"
                  fontWeight="bold"
                  className="pointer-events-none font-sans drop-shadow"
                >
                  SOS: {sos.triage.headcount} people
                </text>
              </g>
            );
          })}

        {/* 9. Prominent Epicenter Alert Pin & Friendly Callout Card matching screenshot */}
        <g transform={`translate(${epicenterX}, ${epicenterY})`} className="cursor-pointer" onClick={() => {
          const flood = featureList.find((f) => f.properties.layer === "bhoonidhi_flood") || featureList[0];
          handleFeatureClick(flood);
        }}>
          {/* Animated concentric ripple */}
          <circle r="24" fill="none" stroke="#EF4444" strokeWidth="1.5" className="animate-ping" opacity="0.5" />

          {/* Red Alert Circle with Exclamation */}
          <circle r="11" fill="#EF4444" stroke="#FFFFFF" strokeWidth="2" className="shadow-lg" />
          <polygon points="-4.5,4.5 4.5,4.5 0,-4.5" fill="#FFFFFF" />
          <text x="0" y="3.5" fill="#EF4444" fontSize="7" fontWeight="bold" textAnchor="middle">!</text>

          {/* Blue Pin next to it */}
          <g transform="translate(14, 2)">
            <circle r="7" fill="#3B82F6" stroke="#FFFFFF" strokeWidth="2" className="shadow-md" />
            <circle r="2.5" fill="#FFFFFF" />
          </g>

          {/* Floating Dark Alert Card Callout */}
          <g transform="translate(18, -48)">
            <rect
              x="0"
              y="0"
              width="128"
              height="42"
              rx="8"
              fill="#0F172A"
              stroke="#1E293B"
              strokeWidth="1.5"
              className="shadow-2xl"
              opacity="0.95"
            />
            {/* Pointer stem */}
            <polygon points="-6,26 0,21 0,31" fill="#0F172A" stroke="#1E293B" strokeWidth="1" />
            {/* Red Alert Icon in Callout */}
            <g transform="translate(10, 15)">
              <polygon points="0,11 12,11 6,1" fill="#EF4444" />
              <text x="6" y="9.5" fill="#FFFFFF" fontSize="7" fontWeight="bold" textAnchor="middle">!</text>
            </g>
            {/* Clean Non-Tech Text Labels matching reference screenshot */}
            <text x="28" y="18" fill="#FFFFFF" fontSize="11" fontWeight="bold" fontFamily="sans-serif">
              Flood Alert
            </text>
            <text x="28" y="31" fill="#94A3B8" fontSize="9" fontWeight="medium" fontFamily="sans-serif">
              High Severity
            </text>
          </g>
        </g>
      </svg>

      {/* Floating Hover Tooltip (Friendly Everyday English) */}
      {hoveredItem && (
        <div
          className="pointer-events-none fixed z-50 bg-[#0F172A] border border-[#1E293B] rounded-lg px-2.5 py-1.5 shadow-xl text-xs font-sans text-white transform -translate-x-1/2 -translate-y-12 animate-fadeIn"
          style={{ left: hoveredItem.x, top: hoveredItem.y }}
        >
          <div className="font-bold text-[11px] text-white">
            {hoveredItem.item.sos_id
              ? `SOS Help Signal: ${hoveredItem.item.triage?.headcount} people trapped`
              : hoveredItem.item.properties?.title}
          </div>
          <div className="text-[10px] text-slate-300">
            {hoveredItem.item.sos_id
              ? `Needs: ${hoveredItem.item.triage?.needs?.join(", ")}`
              : hoveredItem.item.properties?.road_status === "SUBMERGED"
              ? "🔴 Road Blocked: Underwater"
              : hoveredItem.item.properties?.road_status === "CORRIDOR"
              ? "🟢 Safe Evacuation Highway (Dry & Open)"
              : hoveredItem.item.properties?.asset_type === "SHELTER"
              ? "🏥 Safe Relief Camp (Food & Beds)"
              : "Click to see details & safety actions"}
          </div>
        </div>
      )}

      {/* Top Right: Satellite / Map Mode Toggle matching screenshot */}
      <div className="absolute top-3.5 right-3.5 z-20 flex items-center bg-[#0B1322]/90 p-1 rounded-xl border border-[#1E293B] shadow-lg text-xs font-medium backdrop-blur-md">
        <button
          onClick={() => setMapViewMode("satellite")}
          className={`px-3.5 py-1 rounded-lg transition text-xs ${
            mapViewMode === "satellite"
              ? "bg-blue-600 text-white font-semibold shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Satellite
        </button>
        <button
          onClick={() => setMapViewMode("map")}
          className={`px-3.5 py-1 rounded-lg transition text-xs ${
            mapViewMode === "map"
              ? "bg-blue-600 text-white font-semibold shadow-sm"
              : "text-slate-400 hover:text-white"
          }`}
        >
          Map
        </button>
      </div>

      {/* Top Left: Floating Vertical Zoom & Navigation Controls */}
      <div className="absolute top-3 left-3 z-20 flex flex-col bg-[#0F172A]/90 p-1 rounded-xl border border-[#1E293B] shadow-lg text-slate-300 backdrop-blur-md">
        <button
          onClick={() => setZoom((z) => Math.min(z + 0.25, 3.0))}
          className="p-1.5 hover:text-white hover:bg-[#1E293B] rounded-lg transition"
          title="Zoom In"
          aria-label="Zoom In"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          onClick={() => setZoom((z) => Math.max(z - 0.25, 0.75))}
          className="p-1.5 hover:text-white hover:bg-[#1E293B] rounded-lg transition"
          title="Zoom Out"
          aria-label="Zoom Out"
        >
          <Minus className="w-4 h-4" />
        </button>
        <div className="h-px bg-[#1E293B] my-0.5" />
        <button
          onClick={resetView}
          className="p-1.5 hover:text-white hover:bg-[#1E293B] rounded-lg transition"
          title="Center Map on Affected Region"
          aria-label="Recenter"
        >
          <Crosshair className="w-4 h-4" />
        </button>
        <button
          onClick={() => onToggleLayer("bhoonidhi_flood")}
          className="p-1.5 hover:text-white hover:bg-[#1E293B] rounded-lg transition"
          title="Toggle Flood Water On/Off"
          aria-label="Toggle Flood Water"
        >
          <Layers className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Left: Scale Bar (10 km) matching screenshot */}
      <div className="absolute bottom-3.5 left-3.5 z-10 flex items-center space-x-2 bg-[#0B1322]/85 px-2.5 py-1 rounded-lg border border-[#1E293B] text-[10px] text-slate-300 font-sans backdrop-blur-md">
        <span>10 km</span>
        <div className="w-8 h-0.5 bg-white/90 rounded-full" />
      </div>
    </div>
  );
}

export default CommandMap;
