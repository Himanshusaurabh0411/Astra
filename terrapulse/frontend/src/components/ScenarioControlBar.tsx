import React from 'react';
import { CloudRain, Radio, Shield, Navigation, RotateCcw, AlertTriangle, Layers } from 'lucide-react';
import { SystemState } from '../types';

interface ScenarioControlBarProps {
  state: SystemState;
  onSelectStep: (step: number) => void;
  loading: boolean;
}

export const ScenarioControlBar: React.FC<ScenarioControlBarProps> = ({ state, onSelectStep, loading }) => {
  const steps = [
    { id: 0, label: '0. Baseline', sub: 'Normal weather', icon: RotateCcw, color: 'text-slate-400' },
    { id: 1, label: '1. MOSDAC Rain Alert', sub: 'Convective >15mm/hr', icon: CloudRain, color: 'text-orange-400' },
    { id: 2, label: '2. Bhoonidhi SAR Inundation', sub: 'Radar water extraction', icon: Layers, color: 'text-cyan-400' },
    { id: 3, label: '3. VEDAS DEM Dry Routing', sub: 'Submerged roads & routes', icon: Navigation, color: 'text-indigo-400' },
    { id: 4, label: '4. Telecom Blackout & Mesh', sub: 'NavIC + LoRa rescue', icon: Radio, color: 'text-emerald-400' },
  ];

  return (
    <div className="bg-slate-900/80 border-b border-slate-800 px-4 py-3 space-y-3">
      {/* 4-Step Stepper Buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mr-1 hidden sm:inline">
            Golden Path Stepper:
          </span>
          {steps.map((st) => {
            const Icon = st.icon;
            const isActive = state.active_scenario_step === st.id;
            return (
              <button
                key={st.id}
                disabled={loading}
                onClick={() => onSelectStep(st.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition border whitespace-nowrap ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-500 shadow-md shadow-indigo-600/30'
                    : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 border-slate-700/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : st.color}`} />
                <span>{st.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Scenario Status Callout */}
        <div className="flex items-center gap-2 text-xs">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          <span className="text-slate-300 font-medium truncate max-w-md">
            {state.scenario_name}
          </span>
        </div>
      </div>

      {/* Real-time Metrics Ribbon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 text-xs">
        {/* Rainfall */}
        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">MOSDAC Rainfall</span>
          <span className={`text-base font-bold ${state.active_rainfall_mm_hr >= 15 ? 'text-orange-400' : 'text-slate-200'}`}>
            {state.active_rainfall_mm_hr} <span className="text-xs font-normal text-slate-400">mm/hr</span>
          </span>
        </div>

        {/* Flood Extent */}
        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">SAR Inundation Extent</span>
          <span className={`text-base font-bold ${state.flooded_area_sq_km > 10 ? 'text-cyan-400' : 'text-slate-200'}`}>
            {state.flooded_area_sq_km} <span className="text-xs font-normal text-slate-400">sq km</span>
          </span>
        </div>

        {/* Submerged Roads */}
        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">VEDAS Submerged Roads</span>
          <span className={`text-base font-bold ${state.submerged_roads_count > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {state.submerged_roads_count} <span className="text-xs font-normal text-slate-400">blocked</span>
          </span>
        </div>

        {/* Open Corridors */}
        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">Safe Dry Corridors</span>
          <span className="text-base font-bold text-emerald-400">
            {state.open_evacuation_routes_count} <span className="text-xs font-normal text-slate-400">active</span>
          </span>
        </div>

        {/* Tactical Packet Size */}
        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">LoRa Vector Packet</span>
          <span className="text-base font-bold text-indigo-400">
            {state.packet_size_kb > 0 ? `${state.packet_size_kb} KB` : 'Standing by'}
          </span>
        </div>

        {/* SOS Rescues */}
        <div className="p-2 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col">
          <span className="text-[10px] text-slate-400">Active SOS / Rescued</span>
          <span className="text-base font-bold text-amber-400">
            {state.active_sos_count} <span className="text-xs font-normal text-emerald-400">({state.rescues_completed} saved)</span>
          </span>
        </div>
      </div>
    </div>
  );
};
