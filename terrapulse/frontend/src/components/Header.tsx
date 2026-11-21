import React from 'react';
import { Radio, Wifi, WifiOff, Satellite, ShieldCheck, Activity } from 'lucide-react';
import { SystemState } from '../types';

interface HeaderProps {
  state: SystemState;
  fieldMode: boolean;
  setFieldMode: (v: boolean) => void;
}

export const Header: React.FC<HeaderProps> = ({ state, fieldMode, setFieldMode }) => {
  return (
    <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur px-4 py-2.5 flex items-center justify-between">
      {/* Brand & Theme */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
          <Satellite className="w-5 h-5 text-slate-950 font-bold" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="font-extrabold text-base tracking-tight text-white flex items-center gap-1.5">
              TERRAPULSE
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                ASTRA 2026
              </span>
            </h1>
          </div>
          <p className="text-[11px] text-slate-400">
            Multi-Portal Geospatial Intelligence & NavIC Offline Tactical Mesh
          </p>
        </div>
      </div>

      {/* 4 Portals Live Connection Badges */}
      <div className="hidden lg:flex items-center gap-2">
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse" />
          <span className="font-medium text-slate-300">MOSDAC</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="font-medium text-slate-300">Bhoonidhi SAR</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse" />
          <span className="font-medium text-slate-300">VEDAS DEM</span>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-medium text-slate-300">Bhuvan GIS</span>
        </div>
      </div>

      {/* NavIC & Cellular Status & Dual-Mode Toggle */}
      <div className="flex items-center gap-3">
        {/* NavIC Satellite Lock */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-950/40 border border-cyan-800/50 text-[11px] text-cyan-300">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>NavIC (IRNSS) L5/S Locked</span>
        </div>

        {/* Cellular vs Mesh Status */}
        {state.cellular_network_online ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-[11px] text-emerald-300">
            <Wifi className="w-3.5 h-3.5 text-emerald-400" />
            <span>Cellular Online</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-950/60 border border-red-800 text-[11px] text-red-300 animate-pulse">
            <WifiOff className="w-3.5 h-3.5 text-red-400" />
            <span className="font-bold">TELECOM BLACKOUT</span>
            <span className="px-1.5 py-0.2 rounded bg-red-500/20 text-red-300 text-[10px]">LoRa Active</span>
          </div>
        )}

        {/* Field Responder PWA Toggle */}
        <button
          onClick={() => setFieldMode(!fieldMode)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
            fieldMode
              ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
              : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          {fieldMode ? 'Tactical PWA (Airplane)' : 'Command Center View'}
        </button>
      </div>
    </header>
  );
};
