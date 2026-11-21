import React, { useState } from 'react';
import { X, Zap, ShieldAlert, Radio } from 'lucide-react';

interface SosModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { lat: number; lon: number; triage: string; people_count: number; has_medical_emergency: boolean }) => void;
  initialCoords?: { lat: number; lon: number };
}

export const SosModal: React.FC<SosModalProps> = ({ isOpen, onClose, onSubmit, initialCoords }) => {
  const [lat, setLat] = useState(initialCoords?.lat || 20.4450);
  const [lon, setLon] = useState(initialCoords?.lon || 85.8680);
  const [triage, setTriage] = useState('IMMEDIATE_RED');
  const [peopleCount, setPeopleCount] = useState(5);
  const [medical, setMedical] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({ lat, lon, triage, people_count: peopleCount, has_medical_emergency: medical });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl p-5 space-y-4 text-xs">
        <div className="flex items-center justify-between pb-2 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 flex items-center justify-center">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Simulate Offline LoRa SOS Distress Beacon</h3>
              <p className="text-[11px] text-slate-400">Transmitted via NavIC passive GPS & 865 MHz Mesh</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[10px] mb-1 font-semibold uppercase">Latitude (NavIC)</label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>
            <div>
              <label className="block text-slate-400 text-[10px] mb-1 font-semibold uppercase">Longitude (NavIC)</label>
              <input
                type="number"
                step="0.0001"
                value={lon}
                onChange={(e) => setLon(parseFloat(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 text-[10px] mb-1 font-semibold uppercase">Triage Severity</label>
            <select
              value={triage}
              onChange={(e) => setTriage(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold"
            >
              <option value="IMMEDIATE_RED">IMMEDIATE (Red - Life Threatening)</option>
              <option value="URGENT_YELLOW">URGENT (Yellow - Rooftop Trapped)</option>
              <option value="DELAYED_GREEN">DELAYED (Green - Safe High Ground)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 text-[10px] mb-1 font-semibold uppercase">People Trapped</label>
              <input
                type="number"
                min="1"
                max="50"
                value={peopleCount}
                onChange={(e) => setPeopleCount(parseInt(e.target.value))}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white"
              />
            </div>
            <div className="flex items-center pt-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input
                  type="checkbox"
                  checked={medical}
                  onChange={(e) => setMedical(e.target.checked)}
                  className="rounded bg-slate-950 border-slate-700 text-red-500 focus:ring-0"
                />
                <span>Medical Emergency</span>
              </label>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-[11px] text-indigo-300 flex items-center gap-2">
            <Radio className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Transmits over Sub-GHz LoRa (zero SIM, zero mobile data required).</span>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold shadow-lg shadow-red-600/30"
            >
              Broadcast LoRa Beacon
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
