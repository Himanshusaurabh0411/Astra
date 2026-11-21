import React from 'react';
import { Plane, ShieldCheck, Radio, Navigation, CheckCircle, Battery, Compass, ArrowLeft } from 'lucide-react';
import { SystemState, SOSBeacon } from '../types';

interface FieldResponderPwaProps {
  state: SystemState;
  sosBeacons: SOSBeacon[];
  onResolveSos: (id: string) => void;
  onExitFieldMode: () => void;
}

export const FieldResponderPwa: React.FC<FieldResponderPwaProps> = ({
  state,
  sosBeacons,
  onResolveSos,
  onExitFieldMode
}) => {
  return (
    <div className="w-full max-w-2xl mx-auto my-3 p-4 rounded-2xl bg-slate-950 border-2 border-amber-500/40 shadow-2xl space-y-4 text-xs font-sans">
      {/* Top Airplane Mode Emergency Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <button
            onClick={onExitFieldMode}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <div className="flex items-center gap-1.5 text-amber-400 font-bold text-sm">
              <Plane className="w-4 h-4" />
              <span>Tactical Field Responder PWA</span>
            </div>
            <div className="text-[10px] text-slate-400">
              Offline Vector Cache • Airplane Mode Active (Zero Cellular)
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-950/60 border border-cyan-800 text-[11px] text-cyan-300 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
          <span>NavIC: 20.4358°N, 85.8662°E</span>
        </div>
      </div>

      {/* Offline Status HUD */}
      <div className="grid grid-cols-3 gap-2">
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 block">Cellular Status</span>
          <span className="font-extrabold text-red-400">0 Bars (Dead)</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 block">Mesh Radio</span>
          <span className="font-extrabold text-emerald-400">865.2 MHz LoRa</span>
        </div>
        <div className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-center">
          <span className="text-[10px] text-slate-400 block">Cached Vector</span>
          <span className="font-extrabold text-indigo-400">46.8 KB (Active)</span>
        </div>
      </div>

      {/* Turn-by-Turn Dry Route Guidance */}
      <div className="p-3.5 rounded-xl bg-gradient-to-r from-emerald-950/40 via-slate-900 to-slate-900 border border-emerald-800/60 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Navigation className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-white text-xs">Recommended Dry Evacuation Route</span>
          </div>
          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
            Passable (Water 0.0m)
          </span>
        </div>
        <div className="text-[11px] text-slate-200 space-y-1">
          <div>• Target: <span className="font-bold text-emerald-300">Central Cyclone Relief Shelter</span> (Capacity: 1,200)</div>
          <div>• Route: <span className="font-mono text-slate-300">Mahanadi North Embankment Ridge Corridor</span></div>
          <div>• Elevation: <span className="font-mono text-cyan-300">22.0 meters (Above flood crest)</span></div>
          <div className="text-red-400 font-semibold pt-1">
            ⚠️ AVOID State Highway 9: Submerged under 1.4m flowing water
          </div>
        </div>
      </div>

      {/* Nearby Citizen Distress Beacons */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Radio className="w-3.5 h-3.5 text-red-400" />
            Nearby Distress Beacons ({sosBeacons.length})
          </span>
          <span className="text-[10px] text-slate-400">Updated via LoRa P2P</span>
        </div>

        {sosBeacons.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400">
            All nearby citizens rescued. Standing by for dispatch vectors.
          </div>
        ) : (
          <div className="space-y-2">
            {sosBeacons.map((b) => (
              <div key={b.distress_id} className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                    {b.distress_id} ({b.people_count} citizens)
                  </div>
                  <div className="text-[11px] text-slate-300">
                    Status: <span className="text-amber-400 font-semibold">{b.water_level_status}</span> • Battery: {b.battery_pct}%
                  </div>
                  <div className="text-[10px] text-cyan-400 font-mono">
                    NavIC Fix: {b.lat}°N, {b.lon}°E (Distance ~420m)
                  </div>
                </div>
                <button
                  onClick={() => onResolveSos(b.distress_id)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/30 flex items-center gap-1"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Mark Rescued
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
