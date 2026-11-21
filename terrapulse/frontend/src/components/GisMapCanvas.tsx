import React, { useState } from 'react';
import { Layers, Shield, Hospital, Home, AlertCircle, Radio, Navigation, Eye, EyeOff } from 'lucide-react';
import { GisLayerCollection, GisFeature } from '../types';

interface GisMapCanvasProps {
  layers: GisLayerCollection;
  onMapClick?: (lat: number, lon: number) => void;
  onSelectFeature?: (f: GisFeature) => void;
}

export const GisMapCanvas: React.FC<GisMapCanvasProps> = ({ layers, onMapClick, onSelectFeature }) => {
  // Layer visibility toggles
  const [showSar, setShowSar] = useState(true);
  const [showRoads, setShowRoads] = useState(true);
  const [showAssets, setShowAssets] = useState(true);
  const [showSos, setShowSos] = useState(true);
  const [hoveredFeature, setHoveredFeature] = useState<GisFeature | null>(null);

  // Geographic Bounding Box for Cuttack / Mahanadi Catchment Basin
  // Lon: 85.8300 -> 85.9300 (Width = 0.1000 deg)
  // Lat: 20.4200 -> 20.4900 (Height = 0.0700 deg)
  const minLon = 85.8300, maxLon = 85.9300;
  const minLat = 20.4200, maxLat = 20.4900;
  const svgWidth = 850, svgHeight = 520;

  const project = (lon: number, lat: number) => {
    const x = ((lon - minLon) / (maxLon - minLon)) * svgWidth;
    const y = svgHeight - ((lat - minLat) / (maxLat - minLat)) * svgHeight;
    return { x, y };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    
    // Convert back to lat/lon
    const lon = minLon + (clickX / svgWidth) * (maxLon - minLon);
    const lat = minLat + (1 - (clickY / svgHeight)) * (maxLat - minLat);
    if (onMapClick) onMapClick(Number(lat.toFixed(4)), Number(lon.toFixed(4)));
  };

  return (
    <div className="relative w-full h-[540px] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex flex-col">
      {/* Top Map Layer Control Bar */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-1.5 bg-slate-900/90 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs shadow-lg">
        <span className="font-bold text-slate-400 uppercase tracking-wider text-[10px] mr-1 flex items-center gap-1">
          <Layers className="w-3 h-3 text-emerald-400" /> Layers:
        </span>
        <button
          onClick={() => setShowSar(!showSar)}
          className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium transition ${
            showSar ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'bg-slate-800 text-slate-500'
          }`}
        >
          {showSar ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          Bhoonidhi SAR Inundation
        </button>
        <button
          onClick={() => setShowRoads(!showRoads)}
          className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium transition ${
            showRoads ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-slate-800 text-slate-500'
          }`}
        >
          {showRoads ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          VEDAS DEM Corridors
        </button>
        <button
          onClick={() => setShowAssets(!showAssets)}
          className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium transition ${
            showAssets ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-800 text-slate-500'
          }`}
        >
          {showAssets ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          Bhuvan Critical Assets
        </button>
        <button
          onClick={() => setShowSos(!showSos)}
          className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium transition ${
            showSos ? 'bg-red-500/20 text-red-300 border border-red-500/40' : 'bg-slate-800 text-slate-500'
          }`}
        >
          {showSos ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          LoRa SOS Beacons
        </button>
      </div>

      {/* Coordinate & Grid HUD overlay top right */}
      <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded bg-slate-900/90 border border-slate-700 text-[10px] font-mono text-slate-400">
        SECTOR: MAHANADI BASIN [20.45°N, 85.88°E] • NavIC Lock
      </div>

      {/* Interactive Map SVG Canvas */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full h-full cursor-crosshair"
        onClick={handleSvgClick}
      >
        <defs>
          {/* Subtle terrain topography grid */}
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.5" />
          </pattern>
          {/* Water gradient */}
          <linearGradient id="floodGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0284c7" stopOpacity="0.5" />
            <stop offset="100%" stopColor="#0369a1" stopOpacity="0.75" />
          </linearGradient>
          {/* Glow filter */}
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Background Dark Terrain */}
        <rect width={svgWidth} height={svgHeight} fill="#090d16" />
        <rect width={svgWidth} height={svgHeight} fill="url(#grid)" />

        {/* Topography elevation contour lines */}
        <path d="M 50 120 Q 250 80 500 150 T 850 110" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 0 280 Q 300 220 550 300 T 850 260" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />
        <path d="M 30 420 Q 280 390 600 460 T 850 410" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="3 3" />

        {/* LAYER 1: Bhoonidhi SAR Inundation Polygons */}
        {showSar && layers.features
          .filter((f) => f.geometry.type === 'Polygon' && f.properties.source_portal === 'Bhoonidhi')
          .map((f, idx) => {
            const points = f.geometry.coordinates[0].map(([lon, lat]: [number, number]) => {
              const { x, y } = project(lon, lat);
              return `${x},${y}`;
            }).join(' ');

            return (
              <g key={`sar-${idx}`} onMouseEnter={() => setHoveredFeature(f)} onMouseLeave={() => setHoveredFeature(null)}>
                <polygon
                  points={points}
                  fill="url(#floodGrad)"
                  stroke="#38bdf8"
                  strokeWidth="2"
                  filter="url(#glow)"
                  className="transition-all duration-700"
                />
                <text x="320" y="270" fill="#7dd3fc" fontSize="11" fontWeight="bold" opacity="0.8">
                  SAR Radar Water Extent ({f.properties.water_depth_meters ? `${f.properties.water_depth_meters}m depth` : 'Detected'})
                </text>
              </g>
            );
          })}

        {/* LAYER 2: VEDAS DEM Roads & Corridors */}
        {showRoads && layers.features
          .filter((f) => f.geometry.type === 'LineString' && f.properties.source_portal === 'VEDAS')
          .map((f, idx) => {
            const points = f.geometry.coordinates.map(([lon, lat]: [number, number]) => {
              const { x, y } = project(lon, lat);
              return `${x},${y}`;
            }).join(' ');

            const isSubmerged = f.properties.feature_type === 'submerged_road';
            return (
              <g key={`road-${idx}`} onMouseEnter={() => setHoveredFeature(f)} onMouseLeave={() => setHoveredFeature(null)}>
                {/* Thick road line */}
                <polyline
                  points={points}
                  fill="none"
                  stroke={isSubmerged ? '#ef4444' : '#10b981'}
                  strokeWidth={isSubmerged ? '3' : '4'}
                  strokeDasharray={isSubmerged ? '6 4' : 'none'}
                  filter={isSubmerged ? undefined : 'url(#glow)'}
                />
                {/* Road label */}
                <text
                  x={project(f.geometry.coordinates[1][0], f.geometry.coordinates[1][1]).x}
                  y={project(f.geometry.coordinates[1][0], f.geometry.coordinates[1][1]).y - 8}
                  fill={isSubmerged ? '#fca5a5' : '#a7f3d0'}
                  fontSize="9.5"
                  fontWeight="bold"
                >
                  {isSubmerged ? `⚠️ ${f.properties.name} (Submerged ${f.properties.water_depth_meters}m)` : `✅ ${f.properties.name} (Dry Corridor)`}
                </text>
              </g>
            );
          })}

        {/* LAYER 3: Bhuvan Critical Assets (Points) */}
        {showAssets && layers.features
          .filter((f) => f.geometry.type === 'Point' && f.properties.source_portal === 'Bhuvan')
          .map((f, idx) => {
            const { x, y } = project(f.geometry.coordinates[0], f.geometry.coordinates[1]);
            const isMarooned = f.properties.feature_type === 'marooned_village';
            const isShelter = f.properties.feature_type === 'relief_shelter';
            const isHospital = f.properties.feature_type === 'critical_hospital';

            return (
              <g
                key={`bhuvan-${idx}`}
                transform={`translate(${x}, ${y})`}
                onMouseEnter={() => setHoveredFeature(f)}
                onMouseLeave={() => setHoveredFeature(null)}
                className="cursor-pointer"
                onClick={() => onSelectFeature && onSelectFeature(f)}
              >
                {/* Marker Outer Ring */}
                <circle
                  r={isMarooned ? '12' : '10'}
                  fill={isShelter ? '#065f46' : isHospital ? '#1e3a8a' : '#7c2d12'}
                  stroke={isShelter ? '#34d399' : isHospital ? '#60a5fa' : '#fb923c'}
                  strokeWidth="2"
                />
                <circle
                  r="4"
                  fill="#ffffff"
                />
                <text x="14" y="4" fill="#f8fafc" fontSize="10" fontWeight="bold">
                  {f.properties.name}
                </text>
              </g>
            );
          })}

        {/* LAYER 4: LoRa Mesh SOS Distress Beacons */}
        {showSos && layers.features
          .filter((f) => f.geometry.type === 'Point' && f.properties.source_portal === 'TerraPulse_Mesh')
          .map((f, idx) => {
            const { x, y } = project(f.geometry.coordinates[0], f.geometry.coordinates[1]);
            return (
              <g
                key={`sos-${idx}`}
                transform={`translate(${x}, ${y})`}
                onMouseEnter={() => setHoveredFeature(f)}
                onMouseLeave={() => setHoveredFeature(null)}
                className="cursor-pointer"
                onClick={() => onSelectFeature && onSelectFeature(f)}
              >
                {/* Pulse wave ring */}
                <circle r="16" fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.6">
                  <animate attributeName="r" values="8;24" dur="1.5s" repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.8;0" dur="1.5s" repeatCount="indefinite" />
                </circle>
                <circle r="8" fill="#dc2626" stroke="#ffffff" strokeWidth="2" />
                <text x="12" y="-6" fill="#fca5a5" fontSize="10.5" fontWeight="extrabold">
                  🚨 {f.properties.distress_id} ({f.properties.people_count} ppl)
                </text>
              </g>
            );
          })}
      </svg>

      {/* Floating Hover Tooltip */}
      {hoveredFeature && (
        <div className="absolute bottom-4 left-4 z-20 max-w-sm p-3 rounded-xl bg-slate-900/95 border border-slate-700 text-xs shadow-2xl backdrop-blur">
          <div className="flex items-center gap-2 mb-1">
            <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
              {hoveredFeature.properties.source_portal}
            </span>
            <span className="font-bold text-white">
              {hoveredFeature.properties.name || hoveredFeature.properties.distress_id || 'Feature'}
            </span>
          </div>
          <div className="text-[11px] text-slate-300 space-y-0.5">
            <div>Type: <span className="font-medium text-slate-100">{hoveredFeature.properties.feature_type}</span></div>
            {hoveredFeature.properties.elevation_meters && (
              <div>DEM Elevation: <span className="font-medium text-indigo-300">{hoveredFeature.properties.elevation_meters} m</span></div>
            )}
            {hoveredFeature.properties.water_depth_meters && (
              <div>Water Depth: <span className="font-bold text-cyan-300">{hoveredFeature.properties.water_depth_meters} m</span></div>
            )}
            {hoveredFeature.properties.capacity && (
              <div>Capacity: <span className="font-medium text-emerald-300">{hoveredFeature.properties.capacity} persons</span></div>
            )}
            {hoveredFeature.properties.people_count && (
              <div>Stranded: <span className="font-bold text-red-400">{hoveredFeature.properties.people_count} citizens ({hoveredFeature.properties.water_level_status})</span></div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Hint */}
      <div className="absolute bottom-2 right-3 z-10 text-[10px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
        💡 Tip: Click anywhere on map to simulate broadcasting an offline LoRa SOS distress beacon
      </div>
    </div>
  );
};
