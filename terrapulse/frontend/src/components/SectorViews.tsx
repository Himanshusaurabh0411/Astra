"use client";

import React, { useState } from "react";
import {
  Wheat,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  ShieldCheck,
  Building,
  Zap,
  Info,
  Layers,
  Activity,
  ArrowUpRight,
  Database,
  Compass,
} from "lucide-react";
import { TerraPulseStateResponse } from "@/lib/terrapulseClient";

interface SectorViewsProps {
  state: TerraPulseStateResponse | null;
  activeSector: "agri" | "audit";
  onTriggerClaim?: (blockName: string) => void;
  onDispatchCorridor?: (zone: string) => void;
}

export default function SectorViews({
  state,
  activeSector,
  onTriggerClaim,
  onDispatchCorridor,
}: SectorViewsProps) {
  const [selectedBlock, setSelectedBlock] = useState<string>("kothri");
  const [claimStatus, setClaimStatus] = useState<{ [key: string]: boolean }>({});
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const kpis = state?.kpis;
  const isRainBreached = (kpis?.max_rainfall_mm_hr || 0) >= 15.0;
  const isRoadSubmerged = (kpis?.submerged_roads_count || 0) > 0;

  const handleClaim = (blockId: string, blockName: string, farmerCount: number) => {
    setClaimStatus((prev) => ({ ...prev, [blockId]: true }));
    setToastMessage(`PMFBY Parametric claim batch verified for ${farmerCount} cadastral parcels in ${blockName}.`);
    setTimeout(() => setToastMessage(null), 3500);
    onTriggerClaim?.(blockName);
  };

  // --- SECTOR 1: AGRI & CROP STRESS (VEDAS + MOSDAC) ---
  if (activeSector === "agri") {
    const blocks = [
      {
        id: "kothri",
        name: "Kothri Kalan Block (VIT Catchment)",
        latLng: "23.08°N 77.01°E",
        elevation: "492m – 514m AMSL",
        crops: "Soybean (Vegetative) & Kharif Maize",
        farmers: 342,
        ndvi: isRainBreached ? 0.42 : 0.74,
        ndviStatus: isRainBreached ? "Waterlogged / Root Hypoxia Alert" : "Healthy Photosynthetic Canopy",
        soilMoisture: isRainBreached ? "+44% (Saturated Surface Runoff)" : "+14% (Field Capacity)",
        risk: isRainBreached ? "CRITICAL" : "LOW",
        action: isRainBreached
          ? "Open contour ditches along 488m elevation. Muster livestock from Sevan riverbank to VIT High Grounds."
          : "Maintain scheduled drainage culvert clearing.",
      },
      {
        id: "sehore",
        name: "Sehore Rural (Ashta Lowland Inundation)",
        latLng: "23.10°N 77.05°E",
        elevation: "475m – 490m AMSL",
        crops: "Riparian Paddy & Forage Grasslands",
        farmers: 518,
        ndvi: isRoadSubmerged ? 0.38 : 0.69,
        ndviStatus: isRoadSubmerged ? "Riparian Inundation Detected" : "Nominal Vegetative Index",
        soilMoisture: isRoadSubmerged ? "+52% (Severe Waterlogging)" : "+18% (Adequate)",
        risk: isRoadSubmerged ? "HIGH" : "LOW",
        action: isRoadSubmerged
          ? "Sevan River causeway overflow imminent. Suspend agricultural transport over unpaved cart tracks."
          : "Normal seasonal reservoir irrigation flow.",
      },
      {
        id: "bhopal",
        name: "Western Bhopal (Kaliasot / Kerwa Agriland)",
        latLng: "23.18°N 77.38°E",
        elevation: "505m – 522m AMSL",
        crops: "Vegetables & Wheat Seedbed Prep",
        farmers: 280,
        ndvi: 0.71,
        ndviStatus: "Stable Vegetative Canopy",
        soilMoisture: "+21% (Moist / Field Capacity)",
        risk: "MODERATE",
        action: "Monitor reservoir discharge channels from Kerwa spillway. Clear field boundary bunds.",
      },
    ];

    const currentBlock = blocks.find((b) => b.id === selectedBlock) || blocks[0];

    return (
      <div className="flex-1 p-3 flex flex-col space-y-3 overflow-y-auto font-mono text-xs">
        {/* Header Attribution */}
        <div className="flex items-center justify-between pb-2 border-b border-slate-800 flex-shrink-0">
          <div>
            <span className="font-bold text-white text-[11px] block">
              VEDAS & MOSDAC CROP STRESS AUDIT
            </span>
            <span className="text-[10px] text-slate-400">
              Phenology, NDVI & PMFBY Parametric Settlement
            </span>
          </div>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
            isRainBreached ? "bg-rose-950 text-rose-300 border-rose-800" : "bg-emerald-950 text-emerald-300 border-emerald-800"
          }`}>
            RAIN: {kpis?.max_rainfall_mm_hr || 0} / 15.0 mm/h
          </span>
        </div>

        {/* Catchment Block Selector */}
        <div className="grid grid-cols-3 gap-1.5 flex-shrink-0">
          {blocks.map((blk) => (
            <button
              key={blk.id}
              onClick={() => setSelectedBlock(blk.id)}
              className={`p-2 rounded border text-left transition ${
                selectedBlock === blk.id
                  ? "bg-slate-800 text-white border-cyan-500/60"
                  : "bg-slate-900/60 border-slate-800 text-slate-400 hover:text-white"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="truncate">{blk.name.split(" ")[0]}</span>
                <span className={blk.risk === "CRITICAL" ? "text-rose-400" : blk.risk === "HIGH" ? "text-amber-400" : "text-emerald-400"}>
                  {blk.risk}
                </span>
              </div>
              <div className="text-[9px] text-slate-400 mt-1 flex justify-between">
                <span>NDVI {blk.ndvi}</span>
                <span>{blk.farmers}p</span>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Block Metrics Table */}
        <div className="bg-[#0b1120] border border-slate-800 rounded p-2.5 space-y-2">
          <div className="flex justify-between items-center text-slate-300 font-bold text-[11px]">
            <span>{currentBlock.name}</span>
            <span className="text-[10px] text-slate-400">{currentBlock.latLng}</span>
          </div>

          <table className="w-full data-table text-[10px]">
            <tbody>
              <tr>
                <td className="text-slate-400">Canopy Vigor (NDVI):</td>
                <td className="text-right text-white tabular-data font-bold">{currentBlock.ndvi}</td>
              </tr>
              <tr>
                <td className="text-slate-400">Canopy Assessment:</td>
                <td className="text-right text-slate-300">{currentBlock.ndviStatus}</td>
              </tr>
              <tr>
                <td className="text-slate-400">Soil Moisture Anomaly:</td>
                <td className="text-right text-cyan-400 tabular-data">{currentBlock.soilMoisture}</td>
              </tr>
              <tr>
                <td className="text-slate-400">Elevation Profile:</td>
                <td className="text-right text-slate-300 tabular-data">{currentBlock.elevation}</td>
              </tr>
              <tr>
                <td className="text-slate-400">Standing Crops:</td>
                <td className="text-right text-amber-300 font-sans">{currentBlock.crops}</td>
              </tr>
            </tbody>
          </table>

          {/* Operational Advisory */}
          <div className="bg-slate-900/90 p-2 rounded border border-slate-800 text-[10px] text-slate-300 font-sans">
            <strong className="text-amber-400 font-mono block mb-0.5">VEDAS FIELD DIRECTIVE:</strong>
            {currentBlock.action}
          </div>

          {/* PMFBY Parametric Crop Inundation Trigger Box */}
          <div className="border border-slate-800 bg-slate-900/50 p-2.5 rounded space-y-2">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-slate-200">PMFBY PARAMETRIC TRIGGER</span>
              <span className="text-emerald-400">SAR Cadastral Verification</span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans leading-tight">
              Bhoonidhi SAR flood extents intersect cadastral boundaries to verify crop loss without physical field surveyor visits.
            </p>
            <div className="flex justify-between items-center pt-1 border-t border-slate-800">
              <span className="text-slate-400 text-[10px]">
                Target: <strong className="text-white">{currentBlock.farmers} Insured Parcels</strong>
              </span>
              <button
                onClick={() => handleClaim(currentBlock.id, currentBlock.name, currentBlock.farmers)}
                disabled={claimStatus[currentBlock.id]}
                className={`px-2 py-1 rounded text-[10px] font-bold transition ${
                  claimStatus[currentBlock.id]
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-default"
                    : "bg-amber-600 hover:bg-amber-500 text-black border border-amber-400"
                }`}
              >
                {claimStatus[currentBlock.id] ? "CLAIM QUEUED ✓" : "QUEUE PMFBY CLAIM"}
              </button>
            </div>
          </div>
        </div>

        {/* Feedback Message */}
        {toastMessage && (
          <div className="p-2 bg-emerald-950 border border-emerald-800 text-emerald-300 text-[10px] rounded flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    );
  }

  // --- SECTOR 2: HYDROLOGY, DAMS & INFRASTRUCTURE AUDIT (BHUVAN + BHOONIDHI) ---
  const reservoirs = [
    {
      name: "Upper Lake (Bhopal)",
      frl: "508.65m FRL",
      capacityPercent: 92,
      inflow: "420 cumec",
      status: "Sluice Gate 03 Open",
      tier: "ELEVATED",
    },
    {
      name: "Kerwa Dam Reservoir",
      frl: "509.93m FRL",
      capacityPercent: 88,
      inflow: "185 cumec",
      status: "Discharge Nominal",
      tier: "WATCH",
    },
    {
      name: "Kaliasot Dam",
      frl: "505.66m FRL",
      capacityPercent: 84,
      inflow: "140 cumec",
      status: "13 Radial Gates Standby",
      tier: "NOMINAL",
    },
    {
      name: "Sevan River Rural Checkdam",
      frl: "482.00m FRL",
      capacityPercent: isRainBreached ? 104 : 68,
      inflow: isRainBreached ? "310 cumec" : "45 cumec",
      status: isRainBreached ? "SPILLWAY OVERFLOW (+0.85m)" : "Stable Retention",
      tier: isRainBreached ? "CRITICAL" : "NOMINAL",
    },
  ];

  const infrastructureRisks = [
    {
      asset: "Sevan River Causeway (SH-18 Link)",
      type: "Road Bridge",
      elevation: "482m AMSL",
      riskScore: isRoadSubmerged ? "9.4/10" : "3.2/10",
      status: isRoadSubmerged ? "SUBMERGED" : "OPEN",
    },
    {
      asset: "Kothri Kalan Power Substation",
      type: "Electrical Grid",
      elevation: "488m AMSL",
      riskScore: isRainBreached ? "7.8/10" : "2.5/10",
      status: isRainBreached ? "FLOOD WATCH" : "OPERATIONAL",
    },
    {
      asset: "Community Health Centre Kothri Kalan",
      type: "Medical Facility",
      elevation: "498m AMSL",
      riskScore: "2.1/10",
      status: "SAFE",
    },
    {
      asset: "VIT Bhopal Auditorium Relief Camp",
      type: "Designated Shelter",
      elevation: "512m AMSL",
      riskScore: "1.1/10",
      status: "SAFE RIDGE",
    },
  ];

  return (
    <div className="flex-1 p-3 flex flex-col space-y-3 overflow-y-auto font-mono text-xs">
      {/* Header Attribution */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-800 flex-shrink-0">
        <div>
          <span className="font-bold text-white text-[11px] block">
            BHUVAN & BHOONIDHI HYDROLOGICAL AUDIT
          </span>
          <span className="text-[10px] text-slate-400">
            Dam Storage, River Gaging & Cadastral Inundation
          </span>
        </div>
        <span className="text-[10px] text-cyan-400 font-bold">
          EOS-04 SAR
        </span>
      </div>

      {/* Basin Reservoir Storage Status */}
      <div className="bg-[#0b1120] border border-slate-800 rounded p-2.5 space-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          BASIN RESERVOIR STORAGE & INFLOW METRICS
        </span>

        <table className="w-full data-table text-[10px]">
          <thead>
            <tr>
              <th>Reservoir</th>
              <th>Cap</th>
              <th>Inflow</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {reservoirs.map((res) => (
              <tr key={res.name}>
                <td className="text-white font-bold">{res.name}</td>
                <td className="tabular-data">
                  <span className={res.capacityPercent >= 100 ? "text-rose-400 font-bold" : res.capacityPercent >= 85 ? "text-amber-400 font-bold" : "text-cyan-400"}>
                    {res.capacityPercent}%
                  </span>
                </td>
                <td className="text-slate-400 tabular-data">{res.inflow}</td>
                <td>
                  <span className={`px-1 py-0.2 rounded text-[9px] ${
                    res.tier === "CRITICAL"
                      ? "bg-rose-950 text-rose-300 font-bold border border-rose-800"
                      : res.tier === "ELEVATED"
                      ? "bg-amber-950 text-amber-300"
                      : "text-slate-400"
                  }`}>
                    {res.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Municipal Infrastructure Risk Matrix */}
      <div className="bg-[#0b1120] border border-slate-800 rounded p-2.5 space-y-2">
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
          INFRASTRUCTURE FLOOD VULNERABILITY MATRIX
        </span>

        <table className="w-full data-table text-[10px]">
          <thead>
            <tr>
              <th>Asset</th>
              <th>Elev</th>
              <th>Risk</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {infrastructureRisks.map((infra) => (
              <tr key={infra.asset}>
                <td className="text-white">
                  <div>{infra.asset}</div>
                  <div className="text-[9px] text-slate-500">{infra.type}</div>
                </td>
                <td className="text-slate-400 tabular-data">{infra.elevation}</td>
                <td className="tabular-data font-bold">
                  <span className={infra.status === "SUBMERGED" ? "text-rose-400" : infra.status === "FLOOD WATCH" ? "text-amber-400" : "text-emerald-400"}>
                    {infra.riskScore}
                  </span>
                </td>
                <td>
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${
                    infra.status === "SUBMERGED"
                      ? "bg-rose-950 text-rose-300 border border-rose-800"
                      : infra.status === "FLOOD WATCH"
                      ? "bg-amber-950 text-amber-300 border border-amber-800"
                      : "bg-emerald-950 text-emerald-300 border border-emerald-800"
                  }`}>
                    {infra.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Hydro-Geological Infiltration Metrics */}
      <div className="bg-[#0b1120] border border-slate-800 rounded p-2 text-[10px]">
        <div className="grid grid-cols-3 gap-1 text-slate-400">
          <div>Recharge: <strong className="text-emerald-400">78.4%</strong></div>
          <div>Infiltration: <strong className="text-white">18.2 mm/h</strong></div>
          <div>Siltation: <strong className="text-slate-300">12%</strong></div>
        </div>
      </div>
    </div>
  );
}
