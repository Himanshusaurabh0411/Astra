import React, { useState, useEffect } from 'react';
import { Header } from './components/Header';
import { ScenarioControlBar } from './components/ScenarioControlBar';
import { GisMapCanvas } from './components/GisMapCanvas';
import { PortalTelemetryGrid } from './components/PortalTelemetryGrid';
import { TacticalMeshPanel } from './components/TacticalMeshPanel';
import { FieldResponderPwa } from './components/FieldResponderPwa';
import { SosModal } from './components/SosModal';
import { fetchSystemState, fetchGisLayers, triggerStep, resolveSos } from './api';
import { SystemState, GisLayerCollection, SOSBeacon, GisFeature } from './types';
import { Landmark, Radio } from 'lucide-react';

export function App() {
  const [systemState, setSystemState] = useState<SystemState | null>(null);
  const [gisLayers, setGisLayers] = useState<GisLayerCollection | null>(null);
  const [sosBeacons, setSosBeacons] = useState<SOSBeacon[]>([]);
  const [loading, setLoading] = useState(false);
  const [fieldMode, setFieldMode] = useState(false);
  const [rightTab, setRightTab] = useState<'portals' | 'mesh'>('mesh');
  const [sosModalOpen, setSosModalOpen] = useState(false);
  const [clickedCoords, setClickedCoords] = useState<{ lat: number; lon: number } | undefined>(undefined);

  // Load state on mount
  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = async () => {
    setLoading(true);
    try {
      const state = await fetchSystemState();
      const layers = await fetchGisLayers();
      setSystemState(state);
      setGisLayers(layers);

      // Extract SOS beacons from layers
      const beacons: SOSBeacon[] = layers.features
        .filter((f) => f.properties.source_portal === 'TerraPulse_Mesh' && f.properties.feature_type === 'sos_beacon_node')
        .map((f) => ({
          distress_id: f.properties.distress_id || 'SOS-001',
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          altitude_m: 11.5,
          navic_locked: true,
          triage: f.properties.triage || 'IMMEDIATE_RED',
          people_count: f.properties.people_count || 4,
          has_medical_emergency: true,
          water_level_status: f.properties.water_level_status || 'ROOFTOP_TRAPPED',
          battery_pct: f.properties.battery_pct || 65,
          hop_count: f.properties.hop_count || 1,
          timestamp: new Date().toISOString()
        }));
      setSosBeacons(beacons);
    } catch (e) {
      console.error('Error refreshing state:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectStep = async (step: number) => {
    setLoading(true);
    try {
      const newState = await triggerStep(step);
      setSystemState(newState);
      const layers = await fetchGisLayers();
      setGisLayers(layers);

      const beacons: SOSBeacon[] = layers.features
        .filter((f) => f.properties.source_portal === 'TerraPulse_Mesh')
        .map((f) => ({
          distress_id: f.properties.distress_id || 'SOS-001',
          lat: f.geometry.coordinates[1],
          lon: f.geometry.coordinates[0],
          altitude_m: 11.5,
          navic_locked: true,
          triage: f.properties.triage || 'IMMEDIATE_RED',
          people_count: f.properties.people_count || 4,
          has_medical_emergency: true,
          water_level_status: f.properties.water_level_status || 'ROOFTOP_TRAPPED',
          battery_pct: f.properties.battery_pct || 65,
          hop_count: f.properties.hop_count || 1,
          timestamp: new Date().toISOString()
        }));
      setSosBeacons(beacons);

      if (step === 4) {
        setRightTab('mesh');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResolveSos = async (id: string) => {
    await resolveSos(id);
    setSosBeacons((prev) => prev.filter((b) => b.distress_id !== id));
    if (systemState) {
      setSystemState({
        ...systemState,
        active_sos_count: Math.max(0, systemState.active_sos_count - 1),
        rescues_completed: systemState.rescues_completed + 1
      });
    }
    const layers = await fetchGisLayers();
    setGisLayers(layers);
  };

  const handleMapClick = (lat: number, lon: number) => {
    setClickedCoords({ lat, lon });
    setSosModalOpen(true);
  };

  const handleCreateSos = (data: { lat: number; lon: number; triage: string; people_count: number; has_medical_emergency: boolean }) => {
    const newBeacon: SOSBeacon = {
      distress_id: `SOS-${Math.floor(1000 + Math.random() * 9000)}`,
      lat: data.lat,
      lon: data.lon,
      altitude_m: 12.0,
      navic_locked: true,
      triage: data.triage as any,
      people_count: data.people_count,
      has_medical_emergency: data.has_medical_emergency,
      water_level_status: 'ROOFTOP_TRAPPED',
      battery_pct: 94,
      hop_count: 1,
      timestamp: new Date().toISOString()
    };
    setSosBeacons((prev) => [newBeacon, ...prev]);

    if (systemState) {
      setSystemState({
        ...systemState,
        active_sos_count: systemState.active_sos_count + 1
      });
    }

    if (gisLayers) {
      const newFeature: GisFeature = {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [data.lon, data.lat] },
        properties: {
          source_portal: 'TerraPulse_Mesh',
          feature_type: 'sos_beacon_node',
          distress_id: newBeacon.distress_id,
          triage: newBeacon.triage,
          people_count: newBeacon.people_count,
          water_level_status: 'ROOFTOP_TRAPPED',
          battery_pct: 94,
          hop_count: 1,
          severity: 'CRITICAL'
        }
      };
      setGisLayers({
        ...gisLayers,
        features: [...gisLayers.features, newFeature]
      });
    }
  };

  if (!systemState || !gisLayers) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-ping" />
          <span className="font-mono text-sm">Initializing TerraPulse Space-to-Ground Geospatial Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Header */}
      <Header state={systemState} fieldMode={fieldMode} setFieldMode={setFieldMode} />

      {/* Golden Path Scenario Stepper */}
      <ScenarioControlBar state={systemState} onSelectStep={handleSelectStep} loading={loading} />

      {/* Main Content Area */}
      <main className="flex-1 p-3 md:p-4 max-w-[1700px] w-full mx-auto space-y-4">
        {fieldMode ? (
          <FieldResponderPwa
            state={systemState}
            sosBeacons={sosBeacons}
            onResolveSos={handleResolveSos}
            onExitFieldMode={() => setFieldMode(false)}
          />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
            {/* Left 7 Columns: Interactive GIS Canvas */}
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <h2 className="text-sm font-bold text-white tracking-tight">
                    Central Command GIS Map Canvas
                  </h2>
                </div>
                <div className="text-[11px] text-slate-400">
                  Layers: MOSDAC • Bhoonidhi SAR • VEDAS DEM • Bhuvan Cadastres
                </div>
              </div>

              {/* Map Canvas */}
              <GisMapCanvas
                layers={gisLayers}
                onMapClick={handleMapClick}
              />
            </div>

            {/* Right 5 Columns: Tabbed Telemetry & Mesh */}
            <div className="lg:col-span-5 space-y-3">
              {/* Tab Selector */}
              <div className="flex rounded-xl bg-slate-900 p-1 border border-slate-800 text-xs">
                <button
                  onClick={() => setRightTab('mesh')}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
                    rightTab === 'mesh'
                      ? 'bg-slate-800 text-cyan-300 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Radio className="w-3.5 h-3.5" />
                  LoRa Tactical Mesh ({sosBeacons.length})
                </button>
                <button
                  onClick={() => setRightTab('portals')}
                  className={`flex-1 py-1.5 rounded-lg font-bold flex items-center justify-center gap-1.5 transition ${
                    rightTab === 'portals'
                      ? 'bg-slate-800 text-emerald-300 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Landmark className="w-3.5 h-3.5" />
                  4 ISRO Portals (Priority)
                </button>
              </div>

              {/* Panel Content */}
              {rightTab === 'mesh' ? (
                <TacticalMeshPanel
                  state={systemState}
                  sosBeacons={sosBeacons}
                  onResolveSos={handleResolveSos}
                  onOpenSosModal={() => setSosModalOpen(true)}
                />
              ) : (
                <PortalTelemetryGrid state={systemState} />
              )}
            </div>
          </div>
        )}
      </main>

      {/* SOS Modal */}
      <SosModal
        isOpen={sosModalOpen}
        onClose={() => setSosModalOpen(false)}
        onSubmit={handleCreateSos}
        initialCoords={clickedCoords}
      />
    </div>
  );
}

export default App;
