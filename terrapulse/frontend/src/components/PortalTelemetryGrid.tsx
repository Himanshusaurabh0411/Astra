import React from 'react';
import { CloudRain, Layers, Navigation, Landmark, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import { SystemState } from '../types';

interface PortalTelemetryGridProps {
  state: SystemState;
}

export const PortalTelemetryGrid: React.FC<PortalTelemetryGridProps> = ({ state }) => {
  const isRainAnomaly = state.active_rainfall_mm_hr >= 15.0;
  const isFlooded = state.flooded_area_sq_km > 10.0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Landmark className="w-4 h-4 text-emerald-400" />
          4 ISRO National Portals (Evaluation Priority)
        </h3>
        <span className="text-[10px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
          Open Satellite Data Fusion
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
        {/* Portal 1: MOSDAC */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-orange-500/20 text-orange-400 flex items-center justify-center font-bold">
                <CloudRain className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-[11px]">MOSDAC (SAC Ahmedabad)</div>
                <div className="text-[10px] text-slate-400">INSAT-3DS TIR1 & GSMaP ISRO</div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isRainAnomaly ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-800 text-slate-400'
            }`}>
              {isRainAnomaly ? 'ANOMALY TRIGGER' : 'MONITORING'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Convective Rainfall:</span>
              <span className={`font-bold ${isRainAnomaly ? 'text-orange-400' : 'text-slate-200'}`}>
                {state.active_rainfall_mm_hr} mm/hr
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Nowcast Alert Horizon:</span>
              <span className="text-slate-300 font-mono">0–6h Advance Warning</span>
            </div>
          </div>
        </div>

        {/* Portal 2: Bhoonidhi SAR */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center font-bold">
                <Layers className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-[11px]">Bhoonidhi (NRSC Hyderabad)</div>
                <div className="text-[10px] text-slate-400">EOS-04 & NISAR Microwave SAR</div>
              </div>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              isFlooded ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'bg-slate-800 text-slate-400'
            }`}>
              {isFlooded ? 'RADAR INUNDATION' : 'CLEAR PASS'}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Backscatter Threshold:</span>
              <span className="text-cyan-300 font-mono">&lt; -16.5 dB (Water Mask)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Inundation Extent:</span>
              <span className="font-bold text-cyan-400">{state.flooded_area_sq_km} sq km</span>
            </div>
          </div>
        </div>

        {/* Portal 3: VEDAS DEM */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold">
                <Navigation className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-[11px]">VEDAS (SAC Ahmedabad)</div>
                <div className="text-[10px] text-slate-400">Cartosat DEM & Hydrological AI</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              HYDRO ROUTING
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Submerged Highway:</span>
              <span className={`font-bold ${state.submerged_roads_count > 0 ? 'text-red-400' : 'text-slate-200'}`}>
                {state.submerged_roads_count > 0 ? 'SH-9 & DR-12 (Blocked)' : 'None'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Safe Dry Ridge:</span>
              <span className="text-emerald-400 font-bold">NH-16 & Embankment</span>
            </div>
          </div>
        </div>

        {/* Portal 4: Bhuvan GIS */}
        <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                <Landmark className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-white text-[11px]">Bhuvan (NRSC Hyderabad)</div>
                <div className="text-[10px] text-slate-400">1:50k LULC & Gram Panchayat Cadastres</div>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              TRIAGE ACTIVE
            </span>
          </div>
          <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-[11px] space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400">Shelter Evacuation Target:</span>
              <span className="text-emerald-400 font-bold">Central Cyclone Shelter (1,200 cap)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Civil Hospital Status:</span>
              <span className="text-slate-200">Operational (Elevation 19m)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
