"use client";

import React from "react";
import {
  Layers,
  CloudRain,
  Waves,
  Route,
  ShieldCheck,
  Building2,
  Radio,
  CheckCircle2,
  RefreshCw,
  Info,
} from "lucide-react";

interface MapLayersViewProps {
  activeLayers: {
    mosdac_rain: boolean;
    bhoonidhi_flood: boolean;
    vedas_roads: boolean;
    vedas_corridors: boolean;
    bhuvan_assets: boolean;
    sos_mesh: boolean;
  };
  onToggleLayer: (key: string) => void;
  onRefresh?: () => void;
  isAdvancedView?: boolean;
}

export function MapLayersView({
  activeLayers,
  onToggleLayer,
  onRefresh,
  isAdvancedView = false,
}: MapLayersViewProps) {
  const layerDefs = [
    {
      key: "bhoonidhi_flood",
      title: "Bhoonidhi SAR Flood Extent",
      portal: "NRSC HYDERABAD · EOS-04 / NISAR",
      desc: "All-weather cloud-penetrating synthetic aperture radar (C-band 5.4 GHz) mapping active water inundation depth and boundary polygons.",
      active: activeLayers.bhoonidhi_flood,
      icon: <Waves className="w-4 h-4 text-emerald-400" />,
      color: "border-emerald-500/40 text-emerald-400",
      cadence: "Every 15 mins nowcast",
      resolution: "10m SAR Grid",
    },
    {
      key: "mosdac_rain",
      title: "MOSDAC Convective Precipitation (>15 mm/h)",
      portal: "SAC AHMEDABAD · INSAT-3DS IMAGER",
      desc: "Thermal infrared and water-vapour band convective cloudburst nowcasts triggering automated flood cascade when exceeding 15 mm/hr.",
      active: activeLayers.mosdac_rain,
      icon: <CloudRain className="w-4 h-4 text-blue-400" />,
      color: "border-blue-500/40 text-blue-400",
      cadence: "15 min rapid scan",
      resolution: "4 km convective pixel",
    },
    {
      key: "vedas_corridors",
      title: "VEDAS Safe Dry Evacuation Corridors",
      portal: "SAC AHMEDABAD · CARTOSAT-1 DEM",
      desc: "Digital elevation model analysis identifying dry ridge road segments strictly above 510m AMSL for safe evacuation to relief shelters.",
      active: activeLayers.vedas_corridors,
      icon: <ShieldCheck className="w-4 h-4 text-emerald-400" />,
      color: "border-emerald-500/40 text-emerald-400",
      cadence: "Dynamic GIS recompute",
      resolution: "2.5m DEM Contour",
    },
    {
      key: "vedas_roads",
      title: "VEDAS Road Passability Network",
      portal: "SAC AHMEDABAD · CARTOSAT-1 DEM",
      desc: "Cartographic highway and rural road network dynamically classified into Passable (green) or Submerged (red) based on local flood depth.",
      active: activeLayers.vedas_roads,
      icon: <Route className="w-4 h-4 text-slate-300" />,
      color: "border-slate-500/40 text-slate-300",
      cadence: "Live hydrological link",
      resolution: "Vector LineStrings",
    },
    {
      key: "bhuvan_assets",
      title: "Bhuvan Cadastral Assets & Safe Shelters",
      portal: "NRSC HYDERABAD · BHUVAN GEOPORTAL",
      desc: "Cadastral ground truths: relief shelters, community health centres, electrical substations, and Gram Panchayat offices with verified capacities.",
      active: activeLayers.bhuvan_assets,
      icon: <Building2 className="w-4 h-4 text-purple-400" />,
      color: "border-purple-500/40 text-purple-400",
      cadence: "Cadastral Directory",
      resolution: "Sub-meter Geocoded",
    },
    {
      key: "sos_mesh",
      title: "LoRa 865 MHz Tactical Mesh & NavIC Beacons",
      portal: "OFF-GRID TACTICAL MESH · IN865 BAND",
      desc: "Real-time citizen and responder emergency distress beacons relayed across peer-to-peer radio hops directly to central base.",
      active: activeLayers.sos_mesh,
      icon: <Radio className="w-4 h-4 text-amber-400" />,
      color: "border-amber-500/40 text-amber-400",
      cadence: "Instant peer relay",
      resolution: "±1.4m NavIC L5+S",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center space-x-2.5">
            <Layers className="w-6 h-6 text-blue-400" />
            <span>Geospatial Intelligence Layers Manager</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Toggle, configure, and inspect individual ISRO Earth Observation feeds and tactical off-grid layers.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-3.5 py-1.5 rounded-xl bg-[#111A2C] hover:bg-[#1B2944] border border-[#233550] text-xs font-semibold text-slate-200 flex items-center space-x-1.5 transition self-start"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Sync All Layer Feeds</span>
        </button>
      </div>

      {/* Layers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {layerDefs.map((layer) => (
          <div
            key={layer.key}
            className={`bg-[#0D1526] border rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-lg transition ${
              layer.active ? "border-[#1E2E4E]" : "border-[#141F33] opacity-60"
            }`}
          >
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-xl bg-[#111B2E] border border-[#1C2C4A] flex items-center justify-center flex-shrink-0">
                    {layer.icon}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-white">{layer.title}</h3>
                    <span className="text-[10px] text-slate-400 font-mono">{layer.portal}</span>
                  </div>
                </div>

                {/* Toggle switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={layer.active}
                    onChange={() => onToggleLayer(layer.key)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-[#162238] peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <p className="text-xs text-slate-300 leading-snug">
                {layer.desc}
              </p>

              {/* Technical Specifications */}
              {isAdvancedView && (
                <div className="pt-2 border-t border-[#162136] grid grid-cols-2 gap-1.5 text-[10px] font-mono text-slate-400">
                  <div>Cadence: <span className="text-slate-200">{layer.cadence}</span></div>
                  <div>Grid: <span className="text-slate-200">{layer.resolution}</span></div>
                </div>
              )}
            </div>

            <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1 border-t border-[#141E30]">
              <span className="flex items-center space-x-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Status: Stream Connected</span>
              </span>
              <span className="text-blue-400 font-mono font-bold">&lt;100 KB Vector</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default MapLayersView;
