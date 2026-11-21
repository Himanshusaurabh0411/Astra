import React from 'react';
import { Radio, ShieldAlert, CheckCircle, Battery, Users, ArrowUpRight, Zap, RefreshCw } from 'lucide-react';
import { SystemState, SOSBeacon } from '../types';

interface TacticalMeshPanelProps {
  state: SystemState;
  sosBeacons: SOSBeacon[];
  onResolveSos: (id: string) => void;
  onOpenSosModal: () => void;
}

export const TacticalMeshPanel: React.FC<TacticalMeshPanelProps> = ({
  state,
  sosBeacons,
  onResolveSos,
  onOpenSosModal,
}) => {
  return (
    <div className="space-y-3">
      {/* Header & Status */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
          <Radio className="w-4 h-4 text-cyan-400" />
          Domain 04: NavIC & LoRa Tactical Mesh
        </h3>
        <button
          onClick={onOpenSosModal}
          className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-[11px] transition shadow-md shadow-red-600/30 flex items-center gap-1"
        >
          <Zap className="w-3 h-3" />
          + Trigger SOS Beacon
        </button>
      </div>

      {/* Vector Packet Distillation Box */}
      <div className="p-3 rounded-xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-indigo-800/40 text-xs space-y-2">
        <div className="flex items-center justify-between">
          <span className="font-bold text-indigo-300">Actionable Vectorization:</span>
          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] border border-indigo-500/30">
            2 GB Raster → 46.8 KB Micro-Vector
          </span>
        </div>
        <p className="text-[11px] text-slate-300 leading-relaxed">
          Instead of failing to stream 2 gigabyte satellite GeoTIFFs over dead disaster networks, TerraPulse condenses dry evacuation corridors and flood perimeters into lightweight GeoJSON packets delivered over Sub-GHz LoRa radio.
        </p>
      </div>

      {/* Active Distress Beacons List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span>Active LoRa Distress Feeds ({sosBeacons.length})</span>
          <span className="text-[10px] text-emerald-400">865.2 MHz India ISM</span>
        </div>

        {sosBeacons.length === 0 ? (
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-center text-xs text-slate-500">
            No active distress beacons. All sectors clear.
          </div>
        ) : (
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {sosBeacons.map((beacon) => {
              const isRed = beacon.triage === 'IMMEDIATE_RED';
              return (
                <div
                  key={beacon.distress_id}
                  className={`p-3 rounded-xl border text-xs transition space-y-2 ${
                    isRed
                      ? 'bg-red-950/30 border-red-800/60'
                      : 'bg-amber-950/30 border-amber-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 font-extrabold text-white">
                      <span className={`w-2 h-2 rounded-full ${isRed ? 'bg-red-400' : 'bg-amber-400'} animate-ping`} />
                      {beacon.distress_id}
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                        isRed ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
                      }`}>
                        {beacon.triage}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-slate-400">
                      <span className="flex items-center gap-0.5 font-mono">
                        <Battery className="w-3 h-3 text-slate-400" /> {beacon.battery_pct}%
                      </span>
                      <span className="font-mono text-cyan-400">Hop: {beacon.hop_count}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-1 text-[11px] text-slate-300">
                    <div>
                      People: <span className="font-bold text-white">{beacon.people_count} trapped</span>
                    </div>
                    <div>
                      Water Level: <span className="font-semibold text-orange-300">{beacon.water_level_status}</span>
                    </div>
                    <div>
                      NavIC Fix: <span className="text-cyan-300 font-mono">20.4358°N, 85.8662°E</span>
                    </div>
                    <div>
                      Medical Alert: <span className={beacon.has_medical_emergency ? 'text-red-400 font-bold' : 'text-slate-400'}>
                        {beacon.has_medical_emergency ? 'YES (Urgent)' : 'None'}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1 flex items-center justify-between border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Via: Embankment Dry Ridge
                    </span>
                    <button
                      onClick={() => onResolveSos(beacon.distress_id)}
                      className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] transition shadow flex items-center gap-1"
                    >
                      <CheckCircle className="w-3 h-3" />
                      Dispatch Rescue Boat
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
