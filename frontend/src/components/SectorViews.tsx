"use client";

import React, { useState } from "react";
import {
  Wheat,
  Droplets,
  AlertTriangle,
  CheckCircle2,
  ShieldCheck,
  Building,
  Zap,
  ArrowUpRight,
} from "lucide-react";
import { TerraPulseStateResponse } from "@/lib/terrapulseClient";
import { SurveyCard } from "./primitives/SurveyCard";
import { StatusChip } from "./primitives/StatusChip";
import { SectionLabel } from "./primitives/SectionLabel";
import { BudgetMeter } from "./primitives/BudgetMeter";

export interface SectorViewsProps {
  state: TerraPulseStateResponse | null;
  activeSector: "agri" | "audit";
  onTriggerClaim?: (blockName: string) => void;
  onDispatchCorridor?: (zone: string) => void;
}

export function SectorViews({
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
    setToastMessage(`PMFBY Parametric claim verified for ${farmerCount} cadastral parcels in ${blockName}.`);
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
        risk: isRainBreached ? "CRITICAL" : "NORMAL",
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
        risk: isRoadSubmerged ? "WARNING" : "NORMAL",
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
        risk: "WATCH",
        action: "Monitor reservoir discharge channels from Kerwa spillway. Clear field boundary bunds.",
      },
    ];

    const currentBlock = blocks.find((b) => b.id === selectedBlock) || blocks[0];

    return (
      <div className="flex-1 p-3 flex flex-col space-y-3 overflow-y-auto font-mono text-xs">
        {/* Section Header */}
        <SectionLabel
          title="VEDAS & MOSDAC CROP STRESS"
          portal="SAC AHMEDABAD"
          portalColor="text-saffron-400"
          rightAction={
            <StatusChip
              variant={isRainBreached ? "critical" : "normal"}
              size="sm"
              label={`RAIN: ${kpis?.max_rainfall_mm_hr || 0} / 15 mm/h`}
            />
          }
        />

        {/* Catchment Block Selector */}
        <div className="grid grid-cols-3 gap-1.5 flex-shrink-0">
          {blocks.map((blk) => (
            <button
              key={blk.id}
              onClick={() => setSelectedBlock(blk.id)}
              className={`p-2 rounded border text-left transition focus-visible:ring-1 focus-visible:ring-saffron-500 ${
                selectedBlock === blk.id
                  ? "bg-ink-800 text-bone-50 border-saffron-500/70 shadow-sm"
                  : "bg-ink-950/70 border-ink-800 text-bone-400 hover:text-bone-50 hover:bg-ink-900"
              }`}
            >
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="truncate">{blk.name.split(" ")[0]}</span>
                <StatusChip
                  variant={
                    blk.risk === "CRITICAL"
                      ? "critical"
                      : blk.risk === "WARNING"
                      ? "warning"
                      : blk.risk === "WATCH"
                      ? "watch"
                      : "normal"
                  }
                  size="sm"
                  label={blk.risk}
                />
              </div>
              <div className="text-[9px] text-bone-500 mt-1 flex justify-between tabular-nums">
                <span>NDVI {blk.ndvi}</span>
                <span>{blk.farmers}p</span>
              </div>
            </button>
          ))}
        </div>

        {/* Selected Block Metrics Panel */}
        <SurveyCard ticks={true} className="p-2.5 space-y-2">
          <div className="flex justify-between items-center text-bone-50 font-bold text-[11px]">
            <span>{currentBlock.name}</span>
            <span className="text-[10px] text-bone-500 tabular-nums">{currentBlock.latLng}</span>
          </div>

          <table className="w-full text-[10px] font-mono border-collapse">
            <tbody>
              <tr className="border-b border-ink-800">
                <td className="text-bone-500 py-1">Canopy Vigor (NDVI):</td>
                <td className="text-right text-bone-50 tabular-nums font-bold py-1">{currentBlock.ndvi}</td>
              </tr>
              <tr className="border-b border-ink-800">
                <td className="text-bone-500 py-1">Canopy Assessment:</td>
                <td className="text-right text-bone-300 py-1 font-sans">{currentBlock.ndviStatus}</td>
              </tr>
              <tr className="border-b border-ink-800">
                <td className="text-bone-500 py-1">Soil Moisture Anomaly:</td>
                <td className="text-right text-mosdac tabular-nums py-1">{currentBlock.soilMoisture}</td>
              </tr>
              <tr className="border-b border-ink-800">
                <td className="text-bone-500 py-1">Elevation Profile:</td>
                <td className="text-right text-bone-300 tabular-nums py-1">{currentBlock.elevation}</td>
              </tr>
              <tr>
                <td className="text-bone-500 py-1">Standing Crops:</td>
                <td className="text-right text-saffron-400 font-sans py-1">{currentBlock.crops}</td>
              </tr>
            </tbody>
          </table>

          {/* Operational Advisory */}
          <div className="bg-ink-950/80 p-2 rounded border border-ink-700/60 text-[10px] text-bone-300 font-sans">
            <strong className="text-saffron-400 font-mono block mb-0.5 uppercase tracking-survey text-[9px]">
              VEDAS FIELD DIRECTIVE:
            </strong>
            {currentBlock.action}
          </div>

          {/* PMFBY Parametric Crop Inundation Trigger Box */}
          <div className="border border-ink-700/80 bg-ink-950/50 p-2.5 rounded-md space-y-2">
            <div className="flex justify-between items-center text-[10px]">
              <span className="font-bold text-bone-50 uppercase tracking-survey">
                PMFBY PARAMETRIC TRIGGER
              </span>
              <span className="text-emerald-400 text-[9px]">SAR Verification</span>
            </div>
            <p className="text-[10px] text-bone-400 font-sans leading-tight">
              Bhoonidhi EOS-04 SAR flood extents intersect cadastral boundaries to verify crop inundation loss without requiring manual surveyor field visits.
            </p>
            <div className="flex justify-between items-center pt-1 border-t border-ink-800">
              <span className="text-bone-500 text-[10px]">
                Target: <strong className="text-bone-50 tabular-nums">{currentBlock.farmers} Parcels</strong>
              </span>
              <button
                onClick={() => handleClaim(currentBlock.id, currentBlock.name, currentBlock.farmers)}
                disabled={claimStatus[currentBlock.id]}
                className={`px-2.5 py-1 rounded text-[10px] font-mono font-bold transition focus-visible:ring-2 focus-visible:ring-saffron-500 ${
                  claimStatus[currentBlock.id]
                    ? "bg-emerald-950 text-emerald-300 border border-emerald-800 cursor-default"
                    : "bg-saffron-500 hover:bg-saffron-600 text-ink-950"
                }`}
              >
                {claimStatus[currentBlock.id] ? "CLAIM QUEUED ✓" : "QUEUE PMFBY CLAIM"}
              </button>
            </div>
          </div>
        </SurveyCard>

        {/* Feedback Message */}
        {toastMessage && (
          <div className="p-2 bg-emerald-950/90 border border-emerald-700 text-emerald-300 text-[10px] rounded flex items-center space-x-1.5 animate-fadeIn">
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
      tier: "WARNING",
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
      tier: "NORMAL",
    },
    {
      name: "Sevan River Rural Checkdam",
      frl: "482.00m FRL",
      capacityPercent: isRainBreached ? 104 : 68,
      inflow: isRainBreached ? "310 cumec" : "45 cumec",
      status: isRainBreached ? "SPILLWAY OVERFLOW (+0.85m)" : "Stable Retention",
      tier: isRainBreached ? "CRITICAL" : "NORMAL",
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
      {/* Section Header */}
      <SectionLabel
        title="BHUVAN & BHOONIDHI HYDROLOGY"
        portal="NRSC HYDERABAD"
        portalColor="text-bhoonidhi-teal"
        rightAction={<StatusChip variant="saffron" size="sm" label="EOS-04 SAR" />}
      />

      {/* Basin Reservoir Storage Status */}
      <SurveyCard ticks={true} className="p-2.5 space-y-2">
        <span className="text-[10px] font-bold text-bone-500 uppercase tracking-survey block">
          RESERVOIR STORAGE & INFLOW TELEMETRY
        </span>

        <div className="space-y-2">
          {reservoirs.map((res) => (
            <div key={res.name} className="bg-ink-950/70 p-2 rounded border border-ink-800 space-y-1">
              <div className="flex justify-between items-center text-[11px] font-bold">
                <span className="text-bone-50">{res.name}</span>
                <StatusChip
                  variant={
                    res.tier === "CRITICAL"
                      ? "critical"
                      : res.tier === "WARNING"
                      ? "warning"
                      : res.tier === "WATCH"
                      ? "watch"
                      : "normal"
                  }
                  size="sm"
                  label={`${res.capacityPercent}%`}
                />
              </div>
              <BudgetMeter
                current={res.capacityPercent}
                max={100}
                threshold={90}
                unit="%"
                label="Storage Volume"
                sublabel={`${res.frl} • Inflow: ${res.inflow} • ${res.status}`}
              />
            </div>
          ))}
        </div>
      </SurveyCard>

      {/* Cadastral Infrastructure Risk Matrix */}
      <SurveyCard ticks={true} className="p-2.5 space-y-2">
        <span className="text-[10px] font-bold text-bone-500 uppercase tracking-survey block">
          CRITICAL INFRASTRUCTURE FLOOD AUDIT
        </span>

        <table className="w-full text-[10px] font-mono border-collapse">
          <thead>
            <tr className="border-b border-ink-800 text-bone-500 text-left">
              <th className="py-1">Facility</th>
              <th className="py-1">Elev</th>
              <th className="py-1">Risk</th>
              <th className="py-1 text-right">Status</th>
            </tr>
          </thead>
          <tbody>
            {infrastructureRisks.map((inf) => (
              <tr key={inf.asset} className="border-b border-ink-800/60 hover:bg-ink-800/30">
                <td className="py-1.5 text-bone-50 font-bold">{inf.asset.split("(")[0]}</td>
                <td className="py-1.5 text-bone-400 tabular-nums">{inf.elevation}</td>
                <td className="py-1.5 text-saffron-400 tabular-nums font-bold">{inf.riskScore}</td>
                <td className="py-1.5 text-right">
                  <StatusChip
                    variant={
                      inf.status === "SUBMERGED"
                        ? "critical"
                        : inf.status === "FLOOD WATCH"
                        ? "warning"
                        : "normal"
                    }
                    size="sm"
                    label={inf.status}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SurveyCard>
    </div>
  );
}

export default SectorViews;
