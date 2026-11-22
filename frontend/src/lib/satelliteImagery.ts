import { useEffect, useState } from "react";
import type { Bounds, Point } from "./regions";

interface SatelliteFrame { bounds: Bounds; url: string }

export function satelliteRequest(center: Point, scale: number, width: number, height: number, deviceRatio: number): SatelliteFrame {
  const [lng, lat] = center;
  const horizontalScale = scale * Math.cos(lat * Math.PI / 180);
  const halfWidth = width / (2 * horizontalScale);
  const halfHeight = height / (2 * scale);
  const bounds: Bounds = [Math.max(-180, lng - halfWidth), Math.max(-90, lat - halfHeight),
    Math.min(180, lng + halfWidth), Math.min(90, lat + halfHeight)];
  const ratio = Math.min(2, deviceRatio, 2048 / width, 1536 / height);
  const query = new URLSearchParams({
    service: "WMS", request: "GetMap", version: "1.1.1", layers: "s2cloudless-2025", styles: "",
    srs: "EPSG:4326", bbox: bounds.map((value) => value.toFixed(6)).join(","), format: "image/jpeg",
    width: String(Math.max(1, Math.round((bounds[2] - bounds[0]) * horizontalScale * ratio))),
    height: String(Math.max(1, Math.round((bounds[3] - bounds[1]) * scale * ratio))),
  });
  return { bounds, url: `https://tiles.maps.eox.at/wms?${query}` };
}

export function useSatelliteFrame(enabled: boolean, dragging: boolean, center: Point, scale: number, width: number, height: number) {
  const [frame, setFrame] = useState<SatelliteFrame>();
  const [lng, lat] = center;
  useEffect(() => {
    if (!enabled) { setFrame(undefined); return; }
    if (dragging || width < 1 || height < 1 || scale <= 0) return;
    let active = true;
    let preload: HTMLImageElement | undefined;
    const timer = setTimeout(() => {
      const next = satelliteRequest([lng, lat], scale, width, height, window.devicePixelRatio || 1);
      preload = new Image();
      preload.referrerPolicy = "no-referrer";
      preload.onload = () => { if (active) setFrame(next); };
      preload.src = next.url;
    }, 275);
    return () => {
      active = false;
      clearTimeout(timer);
      if (preload) { preload.onload = null; preload.removeAttribute("src"); }
    };
  }, [enabled, dragging, lng, lat, scale, width, height]);
  return enabled ? frame : undefined;
}
