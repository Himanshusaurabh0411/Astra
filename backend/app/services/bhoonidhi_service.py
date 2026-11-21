import logging
from itertools import islice
from math import ceil
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.services.portal_io import read_portal, sample_paths

try:
    import rasterio
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False

try:
    from shapely.geometry import Polygon as ShapelyPolygon, shape, mapping
    HAS_SHAPELY = True
except ImportError:
    HAS_SHAPELY = False

from app.config import settings
from app.models.schemas import (
    GeoJsonFeature,
    GeoJsonFeatureProperties,
    GeoJsonGeometry,
    HazardSeverity,
    ScenarioMode,
    SpatialLayer,
)
from app.models.state import state_store

logger = logging.getLogger("terrapulse.services.bhoonidhi")


class BhoonidhiService:
    """
    Bhoonidhi (National Remote Sensing Centre - NRSC, ISRO Hyderabad) Radar Service
    Primary Mission: EOS-04 (Radar Imaging Satellite RISAT-1A) C-Band SAR, NISAR S/L-Band SAR.
    Operational Role: 24/7 cloud-penetrating all-weather flood inundation extraction.
    Physics: Backscatter thresholding (<-16.5 dB) isolates specular reflections from standing surface flood water.

    Ingestion Tiers:
      1. Live Bhoonidhi STAC / Flood API Endpoint (settings.BHOONIDHI_API_URL)
      2. Local Real Sample Drop (STAC JSON / GeoJSON / CSV / GeoTIFF in data/real_samples/bhoonidhi/)
      3. Seeded Baseline Catchment Fallback
    """

    def __init__(self):
        self.backscatter_threshold_db = -16.5
        self.last_source_origin: str = "seed_fallback"

    def evaluate_flood_inundation(self, rainfall_mm_hr: float) -> Dict[str, Any]:
        """
        Updates bhoonidhi_flood features based on modeled hydrological runoff from MOSDAC precipitation.
        When rainfall >= 15 mm/hr, standing water expands across the Sevan River floodplain.
        """
        if not state_store.features_collection:
            return {}

        is_severe = rainfall_mm_hr >= 15.0
        new_water_depth = round(min(0.2 + (rainfall_mm_hr / 15.0) * 0.75, 3.4), 2) if is_severe else 0.2
        severity = HazardSeverity.CRITICAL if new_water_depth >= 1.5 else (
            HazardSeverity.HIGH if new_water_depth >= 0.8 else HazardSeverity.LOW
        )

        flood_features = []
        for feature in state_store.features_collection.features:
            if feature.properties.layer == SpatialLayer.BHOONIDHI_FLOOD:
                feature.properties.water_depth_m = new_water_depth
                feature.properties.rainfall_mm_hr = rainfall_mm_hr
                feature.properties.severity = severity
                feature.properties.hazard_type = "RIVERINE_INUNDATION" if is_severe else "NONE"
                feature.properties.source_portal = "Bhoonidhi"
                feature.properties.data_source_origin = self.last_source_origin
                feature.properties.recommended_action = (
                    f"BHOONIDHI SAR INUNDATION: Radar backscatter <-16.5 dB detected. "
                    f"Estimated water depth: {new_water_depth}m along Sevan River floodplain."
                    if is_severe else "Normal riverbed channel flow; radar backscatter values nominal."
                )

                if is_severe and feature.geometry.type == "Polygon":
                    expanded_coords = [
                        [
                            [77.0200, 23.0720],
                            [77.0700, 23.0900],
                            [77.1050, 23.1300],
                            [77.0850, 23.1480],
                            [77.0350, 23.1200],
                            [77.0120, 23.0850],
                            [77.0200, 23.0720],
                        ]
                    ]
                    feature.geometry.coordinates = self._simplify_polygon_coordinates(expanded_coords)
                flood_features.append(feature)

        if is_severe and state_store.features_collection.metadata.scenario_mode == ScenarioMode.MOSDAC_RAIN_ALERT:
            state_store.features_collection.metadata.scenario_mode = ScenarioMode.BHOONIDHI_SAR_INUNDATION

        state_store.update_layer_provenance(
            layer="bhoonidhi_flood",
            source_portal="Bhoonidhi",
            ingestion_mode=self.last_source_origin,
            sensor="EOS-04 C-band SAR / NISAR",
        )
        state_store.enforce_payload_budget(settings.MAX_VECTOR_PAYLOAD_KB)
        logger.info(f"Bhoonidhi SAR updated: water_depth={new_water_depth}m, severity={severity}")
        return {
            "satellite": "EOS-04 C-band SAR / NISAR",
            "backscatter_threshold_db": self.backscatter_threshold_db,
            "peak_water_depth_m": new_water_depth,
            "severity": severity,
            "inundation_confirmed": is_severe,
            "data_source_origin": self.last_source_origin,
        }

    def load_records(
        self, override_url: str | None = None, override_path: Path | None = None,
        rainfall_mm_hr: float = 0.0, nationwide: bool = False,
    ) -> tuple[list[GeoJsonFeature], str]:
        paths = [override_path] if override_path else sample_paths(
            settings.BHOONIDHI_SAMPLE_PATH, settings.resolve_bhoonidhi_sample_path(),
            "pan_india_water.geojson", nationwide,
        )
        return read_portal(
            "Bhoonidhi", (SpatialLayer.BHOONIDHI_FLOOD,), override_url or settings.BHOONIDHI_API_URL,
            settings.BHOONIDHI_API_TOKEN, paths,
            lambda doc, source, suffix: self._normalize_transect_csv(doc["records"], source, rainfall_mm_hr)
                if suffix == ".csv" else self._normalize_stac_or_geojson(doc, source, rainfall_mm_hr),
            self._parse_geotiff_flood,
        )

    def ingest_sar_flood_data(
        self, override_url: str | None = None, override_path: Path | None = None, rainfall_mm_hr: float = 16.5,
    ) -> dict:
        features, source = self.load_records(override_url, override_path, rainfall_mm_hr)
        if features:
            self._apply_flood_features_to_store(features, source)
            return self._build_ingestion_summary(features, source)

        self.last_source_origin = "seed_fallback"
        evaluation = self.evaluate_flood_inundation(rainfall_mm_hr)
        return {
            "source_origin": source,
            "features_ingested": sum(f.properties.layer == SpatialLayer.BHOONIDHI_FLOOD for f in state_store.all_features),
            "peak_water_depth_m": evaluation.get("peak_water_depth_m", 0),
            "severity": evaluation.get("severity", HazardSeverity.LOW),
        }

    def _normalize_stac_or_geojson(
        self,
        data: Dict[str, Any],
        source_origin: str,
        rainfall_mm_hr: float,
    ) -> List[GeoJsonFeature]:
        """
        Parses STAC Item or GeoJSON FeatureCollection into compact bhoonidhi_flood features.
        """
        normalized: List[GeoJsonFeature] = []

        if data.get("type") == "Feature":
            items = [data]
        elif "features" in data:
            items = data.get("features", [])
        else:
            items = [data]

        for idx, item in enumerate(items):
            item_id = item.get("id") or f"BHOONIDHI-FLOOD-SAR-{idx+1:02d}"
            props = item.get("properties") or {}
            geom = item.get("geometry") or {}

            depth = props.get("peak_water_depth_m", props.get("water_depth_m"))
            detected = str(props.get("water_detected", "")).lower() in ("true", "1")
            if depth is None and not detected:
                # A STAC acquisition footprint alone says nothing about flooding.
                continue
            water_depth = float(depth) if depth is not None else 0.0
            if not 0 <= water_depth <= 100:
                continue
            backscatter = float(props.get("backscatter_threshold_db", -16.5))
            satellite = props.get("satellite") or props.get("platform") or "Bhoonidhi"
            sensor = props.get("sensor") or "Radar-derived water extent"
            title = props.get("title") or "Mapped standing water"

            coords = geom.get("coordinates")
            geometry_type = geom.get("type")
            if not coords or geometry_type not in ("Polygon", "MultiPolygon"):
                continue
            simplified_coords = (
                [self._simplify_polygon_coordinates(polygon) for polygon in coords]
                if geometry_type == "MultiPolygon" else self._simplify_polygon_coordinates(coords)
            )
            severity = HazardSeverity.CRITICAL if water_depth >= 1.5 else (
                HazardSeverity.HIGH if water_depth >= 0.8 else HazardSeverity.LOW
            )

            if detected and water_depth == 0:
                severity = HazardSeverity.HIGH
            rec_action = "Avoid standing water and check local road closures before leaving."

            feat = GeoJsonFeature(
                id=item_id,
                type="Feature",
                geometry=GeoJsonGeometry(type=geometry_type, coordinates=simplified_coords),
                properties=GeoJsonFeatureProperties(
                    layer=SpatialLayer.BHOONIDHI_FLOOD,
                    title=title,
                    hazard_type="RIVERINE_INUNDATION",
                    severity=severity,
                    rainfall_mm_hr=rainfall_mm_hr,
                    water_depth_m=water_depth,
                    evacuation_priority=5 if water_depth >= 1.5 else 3,
                    recommended_action=rec_action,
                    sensor=f"{satellite} {sensor}",
                    data_source_origin=source_origin,
                    observed_at=props.get("datetime") or props.get("observed_at"),
                    area_km2=props.get("area_km2"),
                    water_detected=detected or water_depth > 0,
                    backscatter_threshold_db=backscatter,
                ),
            )
            normalized.append(feat)

        return normalized

    def _normalize_transect_csv(
        self,
        rows: list[dict],
        source_origin: str,
        rainfall_mm_hr: float,
    ) -> List[GeoJsonFeature]:
        """
        Parses SAR radar backscatter transect points into a simplified flood envelope polygon.
        """
        inundated_pts: List[List[float]] = []
        max_depth = 0.2

        for row in rows:
            if "lat" not in row or ("lng" not in row and "lon" not in row):
                continue
            lat = float(row["lat"])
            lng = float(row.get("lng", row.get("lon")))
            depth = float(row.get("estimated_water_depth_m", 0.0))
            backscatter = float(row.get("backscatter_db", 0.0))
            if backscatter <= self.backscatter_threshold_db or depth >= 0.5:
                max_depth = max(max_depth, depth)
                inundated_pts.append([round(lng, 4), round(lat, 4)])

        if len(inundated_pts) < 3:
            return []
        if inundated_pts[0] != inundated_pts[-1]:
            inundated_pts.append(inundated_pts[0])

        simplified_coords = self._simplify_polygon_coordinates([inundated_pts])
        severity = HazardSeverity.CRITICAL if max_depth >= 1.5 else HazardSeverity.HIGH

        feat = GeoJsonFeature(
            id="BHOONIDHI-FLOOD-TRANSECT-01",
            type="Feature",
            geometry=GeoJsonGeometry(type="Polygon", coordinates=simplified_coords),
            properties=GeoJsonFeatureProperties(
                layer=SpatialLayer.BHOONIDHI_FLOOD,
                title="Sevan River SAR Inundation Reach (Transect Calibrated)",
                hazard_type="RIVERINE_INUNDATION",
                severity=severity,
                rainfall_mm_hr=rainfall_mm_hr,
                water_depth_m=max_depth,
                evacuation_priority=5,
                recommended_action=(
                    f"BHOONIDHI SAR FLOOD: Calibrated transect radar threshold (<-16.5 dB) "
                    f"detects peak flood depth of {max_depth}m."
                ),
                sensor="EOS-04 C-band SAR Transect",
                data_source_origin=source_origin,
            ),
        )
        return [feat]

    def _parse_geotiff_flood(self, data: bytes, source: str) -> list[GeoJsonFeature]:
        if not HAS_RASTERIO:
            return []
        from rasterio.enums import Resampling
        from rasterio.features import shapes
        from rasterio.io import MemoryFile
        from rasterio.warp import transform_geom

        try:
            with MemoryFile(data) as memory, memory.open() as dataset:
                if not dataset.crs:
                    return []
                h, w = min(dataset.height, 512), min(dataset.width, 512)
                band = dataset.read(1, out_shape=(h, w), resampling=Resampling.nearest, masked=True)
                valid = (band <= self.backscatter_threshold_db).filled(False)
                transform = dataset.transform * dataset.transform.scale(dataset.width / w, dataset.height / h)
                masks = shapes(valid.astype("uint8"), mask=valid, transform=transform)
                items = [
                    {
                        "id": f"SAR-MASK-{idx + 1}",
                        "geometry": transform_geom(dataset.crs, "EPSG:4326", geom),
                        "properties": {"water_detected": True, "sensor": "SAR backscatter mask"},
                    }
                    for idx, (geom, _) in enumerate(islice(masks, 128))
                ]
            return self._normalize_stac_or_geojson({"features": items}, source, 0)
        except (OSError, ValueError, RuntimeError):
            logger.info("Bhoonidhi GeoTIFF could not be read.")
            return []

    def _simplify_polygon_coordinates(self, coords: List[List[List[float]]]) -> List[List[List[float]]]:
        """
        Simplifies coordinate rings and rounds vertices to 4 decimals to ensure compact payloads (<100 KB).
        """
        simplified_rings: List[List[List[float]]] = []
        for ring in coords:
            if not ring:
                continue

            # Apply shapely simplification if available
            if HAS_SHAPELY and len(ring) > 8:
                try:
                    poly = ShapelyPolygon(ring)
                    # Tolerance ~0.001 deg (~110m)
                    simplified_poly = poly.simplify(0.0008, preserve_topology=True)
                    ring_coords = list(simplified_poly.exterior.coords)
                except Exception:
                    ring_coords = ring
            else:
                ring_coords = ring

            # Limit vertex count to <= 16 and round floats
            step = max(1, ceil(len(ring_coords) / 15))
            sampled = ring_coords[::step]
            if sampled and sampled[-1] != ring_coords[-1]:
                sampled.append(ring_coords[-1])

            # Ensure polygon closes
            if len(sampled) >= 3 and sampled[0] != sampled[-1]:
                sampled.append(sampled[0])

            rounded_ring = [[round(pt[0], 4), round(pt[1], 4)] for pt in sampled]
            simplified_rings.append(rounded_ring)

        return simplified_rings

    def _apply_flood_features_to_store(self, new_features: List[GeoJsonFeature], source_origin: str) -> None:
        """
        Replaces bhoonidhi_flood features in state_store.features_collection.
        """
        self.last_source_origin = source_origin
        if not state_store.features_collection:
            return

        for f in new_features:
            f.properties.data_source_origin = source_origin
            f.properties.source_portal = "Bhoonidhi"

        retained = [
            f for f in state_store.features_collection.features
            if f.properties.layer != SpatialLayer.BHOONIDHI_FLOOD
        ]
        state_store.features_collection.features = retained + new_features

        state_store.update_layer_provenance(
            layer="bhoonidhi_flood",
            source_portal="Bhoonidhi",
            ingestion_mode=source_origin,
            sensor="EOS-04 C-band SAR / NISAR",
            features_count=len(new_features),
        )

        max_depth = max((f.properties.water_depth_m for f in new_features), default=0.0)
        if max_depth >= 0.8:
            state_store.features_collection.metadata.scenario_mode = ScenarioMode.BHOONIDHI_SAR_INUNDATION

        state_store.enforce_payload_budget(settings.MAX_VECTOR_PAYLOAD_KB)

    def _build_ingestion_summary(self, features: List[GeoJsonFeature], source_origin: str) -> Dict[str, Any]:
        """
        Summarizes ingested flood features.
        """
        max_depth = max((f.properties.water_depth_m for f in features), default=0.0)
        return {
            "source_origin": source_origin,
            "features_ingested": len(features),
            "satellite": "EOS-04 C-band SAR / NISAR",
            "backscatter_threshold_db": self.backscatter_threshold_db,
            "peak_water_depth_m": max_depth,
            "severity": HazardSeverity.CRITICAL if max_depth >= 1.5 else HazardSeverity.HIGH,
            "inundation_confirmed": max_depth >= 0.8,
            "scenario_mode": state_store.features_collection.metadata.scenario_mode.value if state_store.features_collection else "BASELINE",
        }


bhoonidhi_service = BhoonidhiService()
