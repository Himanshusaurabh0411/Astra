import { INDIA, inBounds, type Point } from "./regions";

interface GoogleListener { remove(): void }
interface GoogleFeature {
  getProperty(key: string): unknown;
}
export interface GoogleData {
  addGeoJson(geojson: object): GoogleFeature[];
  setStyle(style: (feature: GoogleFeature) => object): void;
  forEach(callback: (feature: GoogleFeature) => void): void;
  remove(feature: GoogleFeature): void;
  addListener(event: "click", callback: (event: { feature: GoogleFeature }) => void): GoogleListener;
}
interface GooglePoint { lat: number; lng: number }
export interface GoogleMap {
  data: GoogleData;
  getZoom(): number | undefined;
  setZoom(zoom: number): void;
  setMapTypeId(type: MapStyle): void;
  panTo(center: GooglePoint): void;
  addListener(event: string, callback: () => void): GoogleListener;
}
interface GeocoderResult {
  formatted_address: string;
  geometry: { location: { lat(): number; lng(): number } };
}
interface GoogleApi {
  Map: new (node: HTMLElement, options: object) => GoogleMap;
  Geocoder: new () => {
    geocode(request: object): Promise<{ results: GeocoderResult[] }>;
  };
  SymbolPath: { CIRCLE: number };
}
declare global {
  interface Window {
    google?: { maps: GoogleApi };
    gm_authFailure?: () => void;
    terrapulseGoogleMapsReady?: () => void;
  }
}

export type MapStyle = "satellite" | "hybrid" | "roadmap";
export const HAS_GOOGLE_MAPS = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim());
const authEvents = new EventTarget();
let loading: Promise<GoogleApi> | undefined;
let rejectedCredentials = false;

export function onGoogleAuthFailure(handler: () => void): () => void {
  authEvents.addEventListener("failure", handler);
  return () => authEvents.removeEventListener("failure", handler);
}

export function loadGoogleMaps(): Promise<GoogleApi> {
  if (!HAS_GOOGLE_MAPS || rejectedCredentials) return Promise.reject(new Error("Google Maps unavailable"));
  if (window.google?.maps?.Map) return Promise.resolve(window.google.maps);
  if (!loading) {
    loading = new Promise<GoogleApi>((resolve, reject) => {
      const script = document.createElement("script");
      const previousAuthFailure = window.gm_authFailure;
      const fail = () => {
        clearTimeout(timer);
        script.remove();
        delete window.terrapulseGoogleMapsReady;
        reject(new Error("Google Maps unavailable"));
      };
      const timer = setTimeout(fail, 7500);
      window.gm_authFailure = () => {
        rejectedCredentials = true;
        authEvents.dispatchEvent(new Event("failure"));
        previousAuthFailure?.();
        fail();
      };
      window.terrapulseGoogleMapsReady = () => {
        clearTimeout(timer);
        delete window.terrapulseGoogleMapsReady;
        if (window.google?.maps?.Map) resolve(window.google.maps);
        else fail();
      };
      const query = new URLSearchParams({
        key: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!.trim(),
        callback: "terrapulseGoogleMapsReady",
        loading: "async", v: "quarterly", region: "IN", language: "en",
      });
      script.src = `https://maps.googleapis.com/maps/api/js?${query}`;
      script.async = true;
      script.onerror = fail;
      document.head.append(script);
    }).catch((error) => {
      loading = undefined;
      throw error;
    });
  }
  return loading;
}

export async function findGooglePlaces(text: string): Promise<{ name: string; center: Point }[]> {
  const google = await loadGoogleMaps();
  const { results } = await new google.Geocoder().geocode({ address: text, componentRestrictions: { country: "IN" } });
  return results.slice(0, 4).flatMap((result) => {
    const center: Point = [result.geometry.location.lng(), result.geometry.location.lat()];
    return inBounds(center, INDIA.bbox) ? [{ name: result.formatted_address, center }] : [];
  });
}
