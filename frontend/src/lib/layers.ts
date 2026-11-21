import { CloudRain, Droplets, HeartPulse, Radio, Route, TriangleAlert } from "lucide-react";
import type { GeoJsonFeatureProperties, SpatialLayer } from "./terrapulseClient";

export type LayerKey = SpatialLayer | "sos_mesh";
export type ActiveLayers = Record<LayerKey, boolean>;

export const LAYERS = [
  { id: "mosdac_rain", name: "Heavy Rain Watch", description: "Rain that can cause sudden flooding.", provider: "MOSDAC", color: "#5BC0FF", icon: CloudRain },
  { id: "bhoonidhi_flood", name: "Flooded Area", description: "Standing water seen through thick clouds.", provider: "Bhoonidhi", color: "#2DD4C4", icon: Droplets },
  { id: "vedas_roads", name: "Road Closures", description: "Low roads and crossings to avoid.", provider: "VEDAS", color: "#FF6868", icon: TriangleAlert },
  { id: "vedas_corridors", name: "Safe Roads & Escape Routes", description: "Suggested routes along higher ground.", provider: "VEDAS", color: "#F5D547", icon: Route },
  { id: "bhuvan_assets", name: "Hospitals, Schools & Shelters", description: "Relief points, hospitals and local panchayats.", provider: "Bhuvan", color: "#B79CFF", icon: HeartPulse },
  { id: "sos_mesh", name: "Offline Rescue Signal", description: "Exercise SOS requests and radio relay locations.", provider: "NavIC + LoRa", color: "#4ADE80", icon: Radio },
] as const satisfies ReadonlyArray<{ id: LayerKey; name: string; description: string; provider: string; color: string; icon: typeof Route }>;

export const DEFAULT_LAYERS: ActiveLayers = {
  mosdac_rain: true, bhoonidhi_flood: true, vedas_roads: true,
  vedas_corridors: true, bhuvan_assets: true, sos_mesh: true,
};

export function mapColor(props: GeoJsonFeatureProperties): string {
  if (props.layer === "vedas_roads" && props.road_status !== "SUBMERGED") return "#9BE564";
  return LAYERS.find((layer) => layer.id === props.layer)?.color ?? "#B79CFF";
}

export const LABELS = {
  HOSPITAL: "Hospital", SCHOOL: "School", GRAM_PANCHAYAT: "Panchayat",
  SHELTER: "Relief shelter", RESERVOIR: "Reservoir", NONE: "Local area",
};

export const SOURCE_NAMES = {
  live_portal: "Live feed", local_sample: "Sample file", seed_fallback: "Built-in exercise", simulation_spike: "Simulated update",
};
