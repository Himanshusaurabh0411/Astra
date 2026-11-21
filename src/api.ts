import { SystemState, GisLayerCollection, SOSBeacon } from './types';

const API_BASE = 'http://localhost:8000';

// Fallback in-memory state for offline hackathon demonstration
let localStep = 0;
let localRescues = 0;

const BASELINE_FEATURES: GisLayerCollection = {
  type: 'FeatureCollection',
  metadata: { scenario_step: 0, cellular_online: true, lora_mesh_active: false, total_features: 4 },
  features: [
    {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [[[85.8600, 20.4400], [85.8750, 20.4420], [85.8700, 20.4500], [85.8550, 20.4480], [85.8600, 20.4400]]]
      },
      properties: {
        source_portal: 'Bhoonidhi',
        feature_type: 'sar_inundation_boundary',
        name: 'Mahanadi Normal River Basin',
        sensor: 'EOS-04 C-Band SAR',
        severity: 'NORMAL'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[85.8400, 20.4700], [85.8650, 20.4750], [85.8950, 20.4780], [85.9200, 20.4850]]
      },
      properties: {
        source_portal: 'VEDAS',
        feature_type: 'safe_dry_corridor',
        name: 'NH-16 High Elevation Bypass',
        elevation_meters: 18.5,
        passable: true,
        severity: 'NORMAL'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [85.8950, 20.4780]
      },
      properties: {
        source_portal: 'Bhuvan',
        feature_type: 'relief_shelter',
        name: 'Central Cyclone Relief Shelter',
        capacity: 1200,
        status: 'EVACUATION_TARGET',
        severity: 'NORMAL'
      }
    },
    {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [85.8830, 20.4625]
      },
      properties: {
        source_portal: 'Bhuvan',
        feature_type: 'critical_hospital',
        name: 'District Civil Hospital',
        capacity: 350,
        status: 'OPERATIONAL',
        severity: 'NORMAL'
      }
    }
  ]
};

export async function fetchSystemState(): Promise<SystemState> {
  try {
    const res = await fetch(`${API_BASE}/api/state`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) return await res.json();
  } catch (e) {
    // Offline / Mock fallback
  }

  // Local fallback calculation based on current step
  const isBlackout = localStep === 4;
  const isFlood = localStep >= 2;
  return {
    active_scenario_step: localStep,
    scenario_name: getStepName(localStep),
    cellular_network_online: !isBlackout,
    navic_signal_locked: true,
    lora_mesh_active: isBlackout,
    active_rainfall_mm_hr: localStep === 0 ? 4.2 : (localStep === 1 ? 48.6 : (localStep === 2 ? 64.2 : 72.0)),
    flooded_area_sq_km: localStep === 0 ? 2.4 : (localStep === 1 ? 8.5 : (localStep === 2 ? 38.6 : 52.4)),
    submerged_roads_count: isFlood ? 2 : 0,
    open_evacuation_routes_count: 2,
    active_sos_count: isBlackout ? 3 : 0,
    rescues_completed: localRescues,
    packet_size_kb: localStep >= 3 ? 46.8 : 0.0,
    last_updated: new Date().toISOString()
  };
}

export async function fetchGisLayers(): Promise<GisLayerCollection> {
  try {
    const res = await fetch(`${API_BASE}/api/state/layers`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }

  // Return dynamic mock layer collection
  const layers = JSON.parse(JSON.stringify(BASELINE_FEATURES)) as GisLayerCollection;
  layers.metadata.scenario_step = localStep;
  layers.metadata.cellular_online = localStep !== 4;
  layers.metadata.lora_mesh_active = localStep === 4;

  if (localStep >= 2) {
    // Expand flood polygon
    layers.features[0].geometry.coordinates = [[
      [85.8450, 20.4300], [85.8820, 20.4320], [85.8920, 20.4580], [85.8750, 20.4690], [85.8420, 20.4510], [85.8450, 20.4300]
    ]];
    layers.features[0].properties.severity = 'CRITICAL';
    layers.features[0].properties.water_depth_meters = 2.4;

    // Add submerged State Highway 9
    layers.features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[85.8500, 20.4320], [85.8680, 20.4380], [85.8850, 20.4450]]
      },
      properties: {
        source_portal: 'VEDAS',
        feature_type: 'submerged_road',
        name: 'State Highway 9 River Road',
        elevation_meters: 8.2,
        water_depth_meters: 1.4,
        passable: false,
        severity: 'CRITICAL'
      }
    });

    // Add Marooned village
    layers.features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [85.8650, 20.4350]
      },
      properties: {
        source_portal: 'Bhuvan',
        feature_type: 'marooned_village',
        name: 'Banki Riverside Habitation',
        status: 'MAROONED',
        marooned_count: 140,
        severity: 'CRITICAL'
      }
    });
  }

  if (localStep >= 3) {
    // Add VEDAS Embankment Safe Dry Corridor
    layers.features.push({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: [[85.8660, 20.4360], [85.8750, 20.4500], [85.8850, 20.4650], [85.8950, 20.4780]]
      },
      properties: {
        source_portal: 'VEDAS',
        feature_type: 'safe_dry_corridor',
        name: 'Mahanadi North Embankment Ridge',
        elevation_meters: 22.0,
        passable: true,
        severity: 'NORMAL'
      }
    });
  }

  if (localStep === 4) {
    // Add LoRa SOS nodes
    layers.features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [85.8662, 20.4358] },
      properties: {
        source_portal: 'TerraPulse_Mesh',
        feature_type: 'sos_beacon_node',
        distress_id: 'SOS-7701',
        triage: 'IMMEDIATE_RED',
        people_count: 6,
        water_level_status: 'ROOFTOP_TRAPPED',
        battery_pct: 34,
        hop_count: 2,
        severity: 'CRITICAL'
      }
    });
    layers.features.push({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [85.8730, 20.4412] },
      properties: {
        source_portal: 'TerraPulse_Mesh',
        feature_type: 'sos_beacon_node',
        distress_id: 'SOS-7702',
        triage: 'URGENT_YELLOW',
        people_count: 12,
        water_level_status: 'GROUND_FLOOR',
        battery_pct: 58,
        hop_count: 1,
        severity: 'WARNING'
      }
    });
  }

  return layers;
}

export async function triggerStep(step: number): Promise<SystemState> {
  localStep = step;
  try {
    const res = await fetch(`${API_BASE}/api/scenario/step/${step}`, { method: 'POST', signal: AbortSignal.timeout(1500) });
    if (res.ok) return await res.json();
  } catch (e) {
    // fallback
  }
  return fetchSystemState();
}

export async function resolveSos(distressId: string): Promise<boolean> {
  localRescues += 1;
  try {
    const res = await fetch(`${API_BASE}/api/sos/resolve/${distressId}`, { method: 'POST', signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch (e) {
    return true;
  }
}

function getStepName(step: number): string {
  switch (step) {
    case 1: return 'Step 1: MOSDAC Severe Rain Anomaly Trigger (>15 mm/hr)';
    case 2: return 'Step 2: Bhoonidhi Microwave SAR Inundation Extraction';
    case 3: return 'Step 3: VEDAS Cartosat DEM Evacuation Corridor Routing';
    case 4: return 'Step 4: Telecom Blackout & NavIC/LoRa Tactical Rescue Mesh';
    default: return 'Baseline Normal Conditions (Pre-Disaster)';
  }
}
