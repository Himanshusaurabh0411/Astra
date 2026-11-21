import catalog from "../../../contracts/india-regions.json";

export type Point = [lng: number, lat: number];
export type Bounds = [west: number, south: number, east: number, north: number];

export interface Place {
  name: string;
  state: string;
  center: Point;
  aliases: string[];
}

export interface Region {
  id: string;
  name: string;
  short_name: string;
  basin: string;
  center: Point;
  bbox: Bounds;
  zoom: number;
  risk: string;
  hazard: string;
  places: Place[];
  risk_summary?: { heavy_rain_alerts: number; blocked_roads: number; help_requests: number };
}

export const REGIONS = catalog.regions as Region[];
export const INDIA = REGIONS[0];
export const INDIA_REGIONS = REGIONS.slice(1);

export function getRegion(id?: string | null): Region {
  return REGIONS.find((region) => region.id === id) ?? INDIA;
}

export function inBounds([lng, lat]: Point, [west, south, east, north]: Bounds): boolean {
  return west <= lng && lng <= east && south <= lat && lat <= north;
}

export function distanceKm([lng, lat]: Point, [otherLng, otherLat]: Point): number {
  const latitudeScale = Math.cos((lat + otherLat) * Math.PI / 360);
  return 111.32 * Math.hypot((lng - otherLng) * latitudeScale, lat - otherLat);
}

export function nearestRegion(point: Point): Region {
  return INDIA_REGIONS.filter((region) => inBounds(point, region.bbox))
    .sort((a, b) => distanceKm(a.center, point) - distanceKm(b.center, point))[0] ?? INDIA;
}

export function normaliseSearch(value: string): string {
  return value.normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
