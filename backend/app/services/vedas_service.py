import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.services.portal_io import read_portal, sample_paths

try:
    import rasterio
    HAS_RASTERIO = True
except ImportError:
    HAS_RASTERIO = False

from app.config import settings
from app.models.schemas import (
    GeoJsonFeature,
    GeoJsonFeatureProperties,
    GeoJsonGeometry,
    HazardSeverity,
    RoadStatus,
    ScenarioMode,
    SpatialLayer,
)
from app.models.state import state_store

logger = logging.getLogger("terrapulse.services.vedas")


class VedasService:
    """
    VEDAS (Visualisation of Earth Data and Archival System - SAC, Ahmedabad) Hydrological DEM & Agri Service
    Primary Mission: Cartosat High-Resolution DEM (2.5m/10m), STAL Road Network AI, and Crop Stress Phenology.
    Operational Role: Topographical elevation and drainage slope modeling for road network accessibility.
    Decision Logic: Compares modeled water runoff depth against road surface elevation:
      - Low causeways (<470m elev) are classified as SUBMERGED when river crest rises.
      - Cartosat DEM ridge crests (>510m elev) are classified as dry CORRIDOR evacuation paths.

    Ingestion Tiers:
      1. Live Portal URL (settings.VEDAS_API_URL or custom endpoint)
      2. Local Real Sample Drop (Cartosat DEM JSON/GeoTIFF in data/real_samples/vedas/)
      3. Seeded Baseline Catchment Fallback
    """

    def __init__(self):
        self.last_source_origin: str = "seed_fallback"
        self._cached_agri_records: List[Dict[str, Any]] = []

    def evaluate_roads_and_corridors(self, water_depth_m: float, rainfall_mm_hr: float) -> Dict[str, Any]:
        """
        Updates vedas_roads and vedas_corridors features based on Cartosat DEM runoff calculations.
        """
        if not state_store.features_collection:
            return {
                "submerged_roads": 0,
                "open_corridors": 0,
                "causeway_status": "UNKNOWN",
                "data_source_origin": self.last_source_origin,
            }

        is_flooding = water_depth_m >= 0.8
        submerged_count = 0
        open_corridors_count = 0

        for feature in state_store.features_collection.features:
            props = feature.properties

            # 1. Road Networks
            if props.layer == SpatialLayer.VEDAS_ROADS:
                props.source_portal = "VEDAS"
                props.data_source_origin = self.last_source_origin
                props.rainfall_mm_hr = rainfall_mm_hr

                # Low-elevation causeway crossing
                if feature.id == "VEDAS-ROAD-CAUSEWAY-02" or (props.elevation_m and props.elevation_m < 470.0):
                    if is_flooding:
                        props.road_status = RoadStatus.SUBMERGED
                        props.water_depth_m = round(water_depth_m * 1.1, 2)
                        props.severity = HazardSeverity.CRITICAL
                        props.hazard_type = "SUBMERGED_CROSSING"
                        props.evacuation_priority = 5
                        props.recommended_action = (
                            f"ROAD CLOSED: Sevan River causeway submerged under {props.water_depth_m}m of floodwater. "
                            f"DO NOT ATTEMPT CROSSING. Divert all traffic to Cartosat Ridge Corridor."
                        )
                        submerged_count += 1
                    else:
                        props.road_status = RoadStatus.OPEN
                        props.water_depth_m = 0.1
                        props.severity = HazardSeverity.LOW
                        props.hazard_type = "SUBMERGED_CROSSING"
                        props.evacuation_priority = 2
                        props.recommended_action = "Passable; telemetry monitoring active."

                # High-elevation highway
                elif feature.id == "VEDAS-ROAD-SH18-01" or (props.elevation_m and props.elevation_m >= 470.0):
                    props.road_status = RoadStatus.OPEN
                    props.water_depth_m = 0.05 if is_flooding else 0.0
                    props.severity = HazardSeverity.MODERATE if is_flooding else HazardSeverity.LOW
                    props.hazard_type = "SURFACE_RUNOFF" if is_flooding else "NONE"
                    props.evacuation_priority = 2 if is_flooding else 1
                    props.recommended_action = (
                        "Bhopal-Indore Highway (SH-18/NH-46) elevated carriageway open. "
                        "Exercise caution due to heavy monsoon surface runoff."
                        if is_flooding else "High-capacity dual-carriageway open; no waterlogging observed."
                    )

            # 2. High-Elevation Evacuation Corridors
            elif props.layer == SpatialLayer.VEDAS_CORRIDORS:
                props.source_portal = "VEDAS"
                props.data_source_origin = self.last_source_origin
                props.road_status = RoadStatus.CORRIDOR
                props.water_depth_m = 0.0  # Natural ridge above flood crest
                props.rainfall_mm_hr = rainfall_mm_hr
                props.severity = HazardSeverity.LOW
                props.evacuation_priority = 1
                props.recommended_action = (
                    "PRIMARY DRY EVACUATION CORRIDOR: Cartosat DEM ridge (>510m elevation) completely dry and "
                    "passable. Leads directly to VIT Bhopal University Auditorium & Relief Shelter."
                    if is_flooding else "Designated all-weather dry evacuation corridor across Cartosat DEM ridge."
                )
                open_corridors_count += 1

        if is_flooding and state_store.features_collection.metadata.scenario_mode in (
            ScenarioMode.MOSDAC_RAIN_ALERT, ScenarioMode.BHOONIDHI_SAR_INUNDATION
        ):
            state_store.features_collection.metadata.scenario_mode = ScenarioMode.VEDAS_DEM_CORRIDORS

        state_store.update_layer_provenance(
            layer="vedas_roads",
            source_portal="VEDAS",
            ingestion_mode=self.last_source_origin,
            sensor="Cartosat High-Res DEM Hydrology",
        )
        state_store.update_layer_provenance(
            layer="vedas_corridors",
            source_portal="VEDAS",
            ingestion_mode=self.last_source_origin,
            sensor="Cartosat High-Res DEM Hydrology",
        )
        state_store.enforce_payload_budget(settings.MAX_VECTOR_PAYLOAD_KB)
        logger.info(f"VEDAS routing updated: submerged_roads={submerged_count}, open_corridors={open_corridors_count}")
        return {
            "submerged_roads": submerged_count,
            "open_corridors": open_corridors_count,
            "causeway_status": "SUBMERGED" if is_flooding else "OPEN",
            "data_source_origin": self.last_source_origin,
        }

    def load_records(
        self, override_url: str | None = None, override_path: Path | None = None,
        water_depth_m: float = 0.0, rainfall_mm_hr: float = 4.8, nationwide: bool = False,
    ) -> tuple[list[GeoJsonFeature], str]:
        paths = [override_path] if override_path else sample_paths(
            settings.VEDAS_SAMPLE_PATH, settings.resolve_vedas_sample_path(),
            "pan_india_land_and_roads.geojson", nationwide,
        )
        return read_portal(
            "VEDAS", (SpatialLayer.VEDAS_ROADS, SpatialLayer.VEDAS_CORRIDORS),
            override_url or settings.VEDAS_API_URL, settings.VEDAS_API_TOKEN, paths,
            lambda doc, source, _: self._normalize_roads_data(doc, source, water_depth_m, rainfall_mm_hr),
            self._parse_geotiff_raster,
        )

    def ingest_terrain_and_roads(
        self, override_url: str | None = None, override_path: Path | None = None,
        water_depth_m: float = 0.0, rainfall_mm_hr: float = 4.8,
    ) -> dict:
        features, source = self.load_records(override_url, override_path, water_depth_m, rainfall_mm_hr)
        if features:
            self._apply_road_features_to_store(features, source)
            return self._build_ingestion_summary(features, source)

        self.last_source_origin = "seed_fallback"
        evaluation = self.evaluate_roads_and_corridors(water_depth_m, rainfall_mm_hr)
        return {**evaluation, "source_origin": source}

    def _normalize_roads_data(
        self,
        data: Dict[str, Any],
        source_origin: str,
        water_depth_m: float,
        rainfall_mm_hr: float,
    ) -> List[GeoJsonFeature]:
        """
        Parses Cartosat DEM roads profile JSON into standard vedas_roads & vedas_corridors features.
        """
        roads = data.get("roads") or data.get("features") or []
        normalized: List[GeoJsonFeature] = []

        for item in roads:
            if not isinstance(item, dict):
                continue
            r = {**item, **(item.get("properties") or {})}
            geom = r.get("geometry") or {"type": "LineString", "coordinates": r.get("coordinates")}
            if not geom.get("coordinates") or geom.get("type") != "LineString":
                continue
            road_id = str(r.get("road_id") or r.get("id") or f"VEDAS-ROAD-{len(normalized) + 1}")
            name = r.get("name") or r.get("title") or "Road elevation profile"
            elev_m = float(r.get("elevation_m", 0))
            clearance = float(r.get("clearance_m", .4 if elev_m < 470 else 2.0))
            explicit_status = r.get("road_status")
            is_corridor = explicit_status == "CORRIDOR" or "CORRIDOR" in road_id
            is_submerged = not is_corridor and (
                explicit_status == "SUBMERGED" or (water_depth_m > 0 and water_depth_m >= clearance)
            )

            layer = SpatialLayer.VEDAS_CORRIDORS if is_corridor else SpatialLayer.VEDAS_ROADS

            if is_corridor:
                road_status = RoadStatus.CORRIDOR
                severity = HazardSeverity.LOW
                rec_action = "Confirm the high-ground route and destination with local responders."
                evac_priority = 1
            elif is_submerged:
                road_status = RoadStatus.SUBMERGED
                severity = HazardSeverity.CRITICAL
                rec_action = (
                    f"ROAD CLOSED: Causeway submerged at {elev_m}m AMSL under flood crest. "
                    f"DO NOT ATTEMPT CROSSING. Divert to Cartosat Ridge Corridor."
                )
                evac_priority = 5
            else:
                road_status = RoadStatus.OPEN
                severity = HazardSeverity.LOW
                rec_action = f"Passable elevated carriageway ({elev_m}m AMSL); open for transit."
                evac_priority = 2

            feat = GeoJsonFeature(
                id=road_id,
                type="Feature",
                geometry=GeoJsonGeometry(type=geom.get("type", "LineString"), coordinates=geom.get("coordinates")),
                properties=GeoJsonFeatureProperties(
                    layer=layer,
                    title=name,
                    hazard_type="SUBMERGED_CROSSING" if is_submerged else "NONE",
                    severity=severity,
                    rainfall_mm_hr=rainfall_mm_hr,
                    water_depth_m=round(water_depth_m * 1.1, 2) if is_submerged else 0.0,
                    road_status=road_status,
                    evacuation_priority=evac_priority,
                    recommended_action=rec_action,
                    elevation_m=elev_m,
                    clearance_m=clearance,
                    slope_pct=r.get("slope_pct"),
                    observed_at=r.get("observed_at"),
                    sensor="Cartosat-1/Cartosat-2 DEM 2.5m",
                    data_source_origin=source_origin,
                ),
            )
            normalized.append(feat)

        return normalized

    def _parse_geotiff_raster(self, data: bytes, source: str) -> list[GeoJsonFeature]:
        if not HAS_RASTERIO:
            return []
        from math import hypot
        from rasterio.io import MemoryFile
        from rasterio.warp import transform

        roads = []
        try:
            with MemoryFile(data) as memory, memory.open() as dem:
                if not dem.crs:
                    return []
                for feature in state_store.baseline_features:
                    if feature.geometry.type != "LineString" or feature.properties.layer not in (
                        SpatialLayer.VEDAS_ROADS, SpatialLayer.VEDAS_CORRIDORS,
                    ):
                        continue
                    coords = feature.geometry.coordinates
                    lngs, lats = zip(*coords)
                    xs, ys = transform("EPSG:4326", dem.crs, lngs, lats)
                    if not all(dem.bounds.left <= x <= dem.bounds.right and dem.bounds.bottom <= y <= dem.bounds.top
                               for x, y in zip(xs, ys)):
                        continue
                    heights = [band[0] for band in dem.sample(zip(xs, ys), masked=True)]
                    if any(getattr(height, "mask", False) for height in heights):
                        continue
                    distance = sum(hypot(lngs[i] - lngs[i-1], lats[i] - lats[i-1]) * 100_000
                                   for i in range(1, len(coords)))
                    if not distance:
                        continue
                    grade = abs(float(heights[-1] - heights[0])) / distance * 100
                    data = feature.model_copy(deep=True)
                    data.properties.elevation_m = round(float(min(heights)), 1)
                    data.properties.slope_pct = round(grade, 2)
                    data.properties.data_source_origin = source
                    roads.append(data)
        except (OSError, ValueError, RuntimeError):
            logger.info("VEDAS DEM raster could not be read.")
        return roads

    def _apply_road_features_to_store(self, new_features: List[GeoJsonFeature], source_origin: str) -> None:
        """
        Replaces existing vedas_roads and vedas_corridors features in the state store.
        """
        self.last_source_origin = source_origin
        if not state_store.features_collection:
            return

        for f in new_features:
            f.properties.data_source_origin = source_origin
            f.properties.source_portal = "VEDAS"

        retained = [
            f for f in state_store.features_collection.features
            if f.properties.layer not in (SpatialLayer.VEDAS_ROADS, SpatialLayer.VEDAS_CORRIDORS)
        ]
        state_store.features_collection.features = retained + new_features

        roads_count = sum(1 for f in new_features if f.properties.layer == SpatialLayer.VEDAS_ROADS)
        corridors_count = sum(1 for f in new_features if f.properties.layer == SpatialLayer.VEDAS_CORRIDORS)

        state_store.update_layer_provenance(
            layer="vedas_roads",
            source_portal="VEDAS",
            ingestion_mode=source_origin,
            sensor="Cartosat High-Res DEM Hydrology",
            features_count=roads_count,
        )
        state_store.update_layer_provenance(
            layer="vedas_corridors",
            source_portal="VEDAS",
            ingestion_mode=source_origin,
            sensor="Cartosat High-Res DEM Hydrology",
            features_count=corridors_count,
        )

        # Check if low roads submerged
        has_submerged = any(f.properties.road_status == RoadStatus.SUBMERGED for f in new_features)
        if has_submerged and state_store.features_collection.metadata.scenario_mode in (
            ScenarioMode.MOSDAC_RAIN_ALERT, ScenarioMode.BHOONIDHI_SAR_INUNDATION
        ):
            state_store.features_collection.metadata.scenario_mode = ScenarioMode.VEDAS_DEM_CORRIDORS

        state_store.enforce_payload_budget(settings.MAX_VECTOR_PAYLOAD_KB)

    def _build_ingestion_summary(self, features: List[GeoJsonFeature], source_origin: str) -> Dict[str, Any]:
        """
        Summarizes ingested roads and corridors.
        """
        submerged = sum(1 for f in features if f.properties.road_status == RoadStatus.SUBMERGED)
        corridors = sum(1 for f in features if f.properties.road_status == RoadStatus.CORRIDOR)
        return {
            "source_origin": source_origin,
            "roads_evaluated": len(features),
            "submerged_roads": submerged,
            "open_corridors": corridors,
            "scenario_mode": state_store.features_collection.metadata.scenario_mode.value if state_store.features_collection else "BASELINE",
        }

    # =========================================================================
    # Agriculture & PMFBY Crop Stress Phenology Ingestion
    # =========================================================================

    def ingest_crop_stress_data(self, override_path: Optional[Path] = None) -> List[Dict[str, Any]]:
        """
        Ingests real-world or sample VEDAS crop condition, NDVI anomaly, and soil moisture data.
        """
        target_path = override_path or settings.resolve_vedas_agri_sample_path()
        if not target_path or not target_path.exists():
            logger.info("VEDAS agri sample not found; returning synthetic baseline catchment crop status.")
            return self._fallback_crop_records()

        try:
            with open(target_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            blocks = data.get("blocks") or []
            self._cached_agri_records = blocks
            return blocks
        except Exception as e:
            logger.warning(f"Failed to parse VEDAS crop stress JSON from {target_path} ({e}); using fallback.")
            return self._fallback_crop_records()

    def get_crop_stress_summary(self) -> Dict[str, Any]:
        """
        Computes aggregate agricultural impact metrics across the Sehore/Bhopal basin.
        """
        records = self._cached_agri_records or self.ingest_crop_stress_data()
        total_inundated_ha = sum(float(r.get("inundated_hectares", 0.0)) for r in records)
        eligible_blocks = [r.get("block_name") for r in records if r.get("pmfby_eligible")]
        avg_ndvi_anomaly = round(
            sum(float(r.get("ndvi_anomaly_pct", 0.0)) for r in records) / max(len(records), 1),
            1,
        )

        return {
            "total_blocks_monitored": len(records),
            "total_inundated_hectares": total_inundated_ha,
            "avg_ndvi_anomaly_pct": avg_ndvi_anomaly,
            "pmfby_eligible_blocks": eligible_blocks,
            "blocks": records,
            "data_source_origin": self.last_source_origin,
        }

    def _fallback_crop_records(self) -> List[Dict[str, Any]]:
        """
        Baseline fallback crop records for Sehore / Bhopal rural sectors.
        """
        return [
            {
                "block_id": "VEDAS-AGRI-KOTHRI",
                "block_name": "Kothri Kalan / Sehore Rural",
                "major_crop": "Soybean (JS-9560)",
                "phenology_stage": "Pod Filling",
                "mean_ndvi": 0.68,
                "ndvi_anomaly_pct": -18.1,
                "soil_moisture_pct": 89.4,
                "inundated_hectares": 1420.0,
                "crop_stress_status": "HIGH_WATERLOGGING_STRESS",
                "pmfby_eligible": True,
                "pmfby_clause": "Clause 2.4 - Localized Calamity",
            },
            {
                "block_id": "VEDAS-AGRI-ICHHAWAR",
                "block_name": "Ichhawar Basin",
                "major_crop": "Kharif Paddy",
                "phenology_stage": "Vegetative Tillering",
                "mean_ndvi": 0.75,
                "ndvi_anomaly_pct": -5.1,
                "soil_moisture_pct": 94.2,
                "inundated_hectares": 780.0,
                "crop_stress_status": "MODERATE_INUNDATION",
                "pmfby_eligible": False,
                "pmfby_clause": "Tolerance threshold intact",
            },
        ]


vedas_service = VedasService()
