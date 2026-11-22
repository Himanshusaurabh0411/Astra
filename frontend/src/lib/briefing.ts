import { getRegion, INDIA, nearestRegion, type Point, type Region } from "./regions";
import { featurePoint, featureRegion, type GeoJsonFeature, type HazardSeverity, type SOSPacket, type TerraPulseStateResponse } from "./terrapulseClient";

export type FocusItem =
  | { kind: "feature"; feature: GeoJsonFeature }
  | { kind: "help"; request: SOSPacket }
  | { kind: "place"; name: string; center: Point; regionId: string };

export interface Brief {
  title: string;
  place: string;
  region: Region;
  severity: HazardSeverity;
  kind: string;
  what: string;
  impact: string;
  actions: string[];
  time?: string;
  center: Point;
}

export function formatNumber(value: number | undefined | null, decimals = 0): string {
  if (value === undefined || value === null || Number.isNaN(value)) return "0";
  return value.toLocaleString("en-IN", { maximumFractionDigits: decimals });
}

export function timeOf(value: string | undefined, zone = "Asia/Kolkata"): string {
  if (!value || !Number.isFinite(Date.parse(value))) return "Exercise snapshot";
  return new Intl.DateTimeFormat("en-GB", { timeStyle: "short", hourCycle: "h23", timeZone: zone }).format(new Date(value));
}

export function friendlyNeed(value: string): string {
  const label = value.toLowerCase().replaceAll("_", " ");
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function isAlert(feature: GeoJsonFeature, threshold = 15): boolean {
  const props = feature.properties;
  return props.road_status === "SUBMERGED"
    || (props.layer === "mosdac_rain" && (props.rainfall_mm_hr ?? 0) > threshold)
    || (props.layer === "bhoonidhi_flood" && ((props.water_depth_m ?? 0) >= .5 || props.water_detected === true));
}

export function defaultFeature(state: TerraPulseStateResponse): GeoJsonFeature | undefined {
  const features = state.features.features;
  const threshold = state.features.metadata.rainfall_threshold_mm_hr;
  return features.filter((f) => isAlert(f, threshold)).sort((a, b) =>
    (Number(b.properties.severity === "CRITICAL") - Number(a.properties.severity === "CRITICAL"))
    || ((b.properties.water_depth_m ?? 0) - (a.properties.water_depth_m ?? 0)))[0]
    ?? features.find((f) => f.properties.layer === "mosdac_rain");
}

export function briefing(item: FocusItem | null, region: Region, state: TerraPulseStateResponse): Brief {
  if (!item) {
    const feature = defaultFeature(state);
    if (feature) return briefing({ kind: "feature", feature }, region, state);
  }

  if (item?.kind === "help") {
    const { request } = item;
    const center: Point = [request.position.lng, request.position.lat];
    const area = nearestRegion(center);
    return {
      title: "Help request", place: area.short_name, region: area, severity: request.triage.severity, kind: "Rescue",
      what: `A field responder reported a need for ${request.triage.needs.map(friendlyNeed).join(", ").toLowerCase() || "assistance"}.`,
      impact: `${request.triage.headcount} people are included in this exercise request.`,
      actions: ["Confirm the location with the field team.", "Check nearby shelters and roads before dispatching assistance."],
      time: request.timestamp, center,
    };
  }

  if (item?.kind === "feature") {
    const { feature } = item;
    const p = feature.properties;
    const center = featurePoint(feature);
    const area = featureRegion(feature);
    const common = { place: p.place_name ?? area.short_name, region: area, center, time: p.observed_at ?? state.last_updated };
    const severity = p.severity ?? "LOW";
    const threshold = state.features.metadata.rainfall_threshold_mm_hr ?? 15;
    if (p.layer === "mosdac_rain") {
      const heavy = (p.rainfall_mm_hr ?? 0) > threshold;
      return {
        ...common, severity: heavy ? severity === "CRITICAL" ? "CRITICAL" : "HIGH" : "LOW",
        title: heavy ? "Heavy rain watch" : "Rainfall update", kind: "Rain",
        what: `Rain is falling at ${formatNumber(p.rainfall_mm_hr ?? 0, 1)} mm per hour${heavy ? ", above the heavy rain threshold." : "."}`,
        impact: heavy ? "Low-lying homes, farms and road crossings can flood first." : "Neighbours and travellers can check this reading before making plans.",
        actions: heavy ? ["Avoid low crossings and waterlogged roads.", "Check the high-ground route and nearest relief shelter."] : ["Check local weather before leaving."],
      };
    }
    if (p.layer === "bhoonidhi_flood") {
      const water = p.water_detected || (p.water_depth_m ?? 0) > 0;
      return {
        ...common, severity, kind: "Flood",
        title: water ? p.title : "River conditions",
        what: water
          ? `The water layer shows standing water here${p.water_depth_m ? ` up to ${formatNumber(p.water_depth_m, 2)} m deep` : ""}.`
          : "No flooded area is marked in this snapshot.",
        impact: water ? "Riverside residents, low fields and nearby road crossings may be affected." : "Conditions can change after local rain.",
        actions: water ? ["Stay away from flooded crossings.", "Check the marked high-ground route and confirm it with local responders."] : ["Check local notices before travelling."],
      };
    }
    if (p.layer === "vedas_roads" || p.layer === "vedas_corridors") {
      const blocked = p.road_status === "SUBMERGED";
      const corridor = p.road_status === "CORRIDOR";
      return {
        ...common, title: p.title, severity, kind: blocked ? "Road closure" : "Route",
        what: blocked ? "The exercise map marks this crossing as flooded." : corridor
          ? "This route follows higher ground towards a relief point." : "The exercise map shows this road as open.",
        impact: "People travelling through this area should check the road before leaving.",
        actions: [blocked ? "Avoid this crossing and find a higher route." : "Confirm passability with local responders."],
      };
    }
    return {
      ...common, title: p.title, severity, kind: "Local services",
      what: p.storage_pct !== undefined
        ? `The reservoir is at ${formatNumber(p.storage_pct, 1)}% of its mapped storage capacity.`
        : p.land_use ? `The map shows ${p.land_use.toLowerCase()} in this area.`
          : "A local relief or public service point is marked here.",
      impact: p.capacity ? `This exercise record lists capacity for ${formatNumber(p.capacity)} people.` : "Check conditions with the local team before travelling.",
      actions: ["Confirm opening hours and availability with the local team."],
    };
  }

  const area = item?.kind === "place" ? getRegion(item.regionId) : region;
  const name = item?.kind === "place" ? item.name : area.name;
  return {
    title: name, place: area.id === INDIA.id ? "India" : area.basin, region: area,
    severity: "LOW", kind: "Location", center: item?.kind === "place" ? item.center : area.center,
    what: "This location is centered on the map. Select a coloured marker to read its latest update.",
    impact: "Available records depend on which feeds and exercise areas cover this location.",
    actions: ["Check local notices before travelling."],
  };
}
