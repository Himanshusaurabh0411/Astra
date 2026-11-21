export type Severity = 'NORMAL' | 'WATCH' | 'WARNING' | 'CRITICAL';
export type TriageLevel = 'IMMEDIATE_RED' | 'URGENT_YELLOW' | 'DELAYED_GREEN' | 'EXPECTANT_BLACK';

export interface SystemState {
  active_scenario_step: number;
  scenario_name: string;
  cellular_network_online: boolean;
  navic_signal_locked: boolean;
  lora_mesh_active: boolean;
  active_rainfall_mm_hr: number;
  flooded_area_sq_km: number;
  submerged_roads_count: number;
  open_evacuation_routes_count: number;
  active_sos_count: number;
  rescues_completed: number;
  packet_size_kb: number;
  last_updated: string;
}

export interface GisFeature {
  type: 'Feature';
  geometry: {
    type: 'Point' | 'LineString' | 'Polygon';
    coordinates: any;
  };
  properties: {
    source_portal: 'MOSDAC' | 'Bhoonidhi' | 'VEDAS' | 'Bhuvan' | 'TerraPulse_Mesh';
    feature_type: string;
    name?: string;
    severity?: Severity;
    water_depth_meters?: number;
    elevation_meters?: number;
    passable?: boolean;
    sensor?: string;
    capacity?: number;
    marooned_count?: number;
    status?: string;
    distress_id?: string;
    triage?: TriageLevel;
    people_count?: number;
    navic_locked?: boolean;
    water_level_status?: string;
    battery_pct?: number;
    hop_count?: number;
  };
}

export interface GisLayerCollection {
  type: 'FeatureCollection';
  metadata: {
    scenario_step: number;
    cellular_online: boolean;
    lora_mesh_active: boolean;
    total_features: number;
  };
  features: GisFeature[];
}

export interface SOSBeacon {
  distress_id: string;
  lat: number;
  lon: number;
  altitude_m: number;
  navic_locked: boolean;
  triage: TriageLevel;
  people_count: number;
  has_medical_emergency: boolean;
  water_level_status: string;
  battery_pct: number;
  hop_count: number;
  timestamp: string;
}
