import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

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

    def ingest_terrain_and_roads(
        self,
        override_url: Optional[str] = None,
        override_path: Optional[Path] = None,
        water_depth_m: float = 0.0,
        rainfall_mm_hr: float = 4.8,
    ) -> Dict[str, Any]:
        """
        Ingests real-world Cartosat DEM roads profile with automatic 3-tier fallback.
        """
        target_url = override_url or settings.VEDAS_API_URL
        target_path = override_path or settings.resolve_vedas_sample_path()

        # Tier 1: Try Live VEDAS Portal Endpoint
        if target_url:
            try:
                logger.info(f"Attempting Tier 1 fetch from VEDAS live endpoint: {target_url}")
                with httpx.Client(timeout=4.0) as client:
                    resp = client.get(target_url)
                    if resp.status_code == 200:
                        data = resp.json()
                        features = self._normalize_roads_data(data, source_origin="live_portal", water_depth_m=water_depth_m, rainfall_mm_hr=rainfall_mm_hr)
                        if features:
                            self._apply_road_features_to_store(features, source_origin="live_portal")
                            return self._build_ingestion_summary(features, source_origin="live_portal")
            except Exception as e:
                logger.warning(f"Tier 1 live VEDAS fetch failed ({e}). Falling back to Tier 2 local sample.")

        # Tier 2: Try Real Local Sample Drop
        if target_path and target_path.exists():
            try:
                logger.info(f"Attempting Tier 2 load from local VEDAS sample: {target_path}")
                if target_path.suffix.lower() in (".tif", ".tiff"):
                    features = self._parse_geotiff_raster(target_path, source_origin="local_sample", water_depth_m=water_depth_m)
                elif target_path.suffix.lower() == ".json":
                    with open(target_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    features = self._normalize_roads_data(data, source_origin="local_sample", water_depth_m=water_depth_m, rainfall_mm_hr=rainfall_mm_hr)
                else:
                    features = []

                if features:
                    self._apply_road_features_to_store(features, source_origin="local_sample")
                    return self._build_ingestion_summary(features, source_origin="local_sample")
            except Exception as e:
                logger.warning(f"Tier 2 local VEDAS sample parsing failed ({e}). Falling back to Tier 3 seed.")

        # Tier 3: Fallback to Seeded Catchment Baseline
        logger.info("Executing Tier 3 fallback to VEDAS seeded baseline.")
        self.last_source_origin = "seed_fallback"
        eval_res = self.evaluate_roads_and_corridors(water_depth_m, rainfall_mm_hr)
        return {
            "source_origin": "seed_fallback",
            "roads_evaluated": 3,
            "submerged_roads": eval_res.get("submerged_roads", 0),
            "open_corridors": eval_res.get("open_corridors", 1),
            "scenario_mode": state_store.features_collection.metadata.scenario_mode.value if state_store.features_collection else "BASELINE",
        }

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

        for r in roads:
            road_id = r.get("road_id") or r.get("id") or "VEDAS-ROAD-01"
            name = r.get("name") or r.get("title") or "Cartosat Modeled Road"
            elev_m = float(r.get("elevation_m", 475.0))
            is_corridor = elev_m >= 510.0 or "CORRIDOR" in road_id
            is_submerged = (not is_corridor) and (elev_m < 470.0 and water_depth_m >= 0.40)

            geom = r.get("geometry")
            if not geom:
                coords = r.get("coordinates") or [[77.035, 23.082], [77.062, 23.091]]
                geom = {"type": "LineString", "coordinates": coords}

            layer = SpatialLayer.VEDAS_CORRIDORS if is_corridor else SpatialLayer.VEDAS_ROADS

            if is_corridor:
                road_status = RoadStatus.CORRIDOR
                severity = HazardSeverity.LOW
                rec_action = (
                    "PRIMARY DRY EVACUATION CORRIDOR: Cartosat DEM ridge (>510m elevation) completely dry and "
                    "passable. Leads directly to VIT Bhopal University Auditorium & Relief Shelter."
                )
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
                    sensor="Cartosat-1/Cartosat-2 DEM 2.5m",
                    data_source_origin=source_origin,
                ),
            )
            normalized.append(feat)

        return normalized

    def _parse_geotiff_raster(self, tif_path: Path, source_origin: str, water_depth_m: float) -> List[GeoJsonFeature]:
        """
        Parses GeoTIFF Cartosat DEM elevation raster using rasterio when installed.
        """
        if not HAS_RASTERIO:
            logger.warning("rasterio is not installed in environment; skipping GeoTIFF parsing.")
            return []

        try:
            with rasterio.open(tif_path) as src:
                elev_band = src.read(1)
                mean_elev = float(elev_band.mean())
                min_elev = float(elev_band.min())
                logger.info(f"Loaded Cartosat DEM raster: shape={elev_band.shape}, min_elev={min_elev}m, mean={mean_elev}m")

            # Fallback to normalized roads using raster-derived elevation bounds
            return self._normalize_roads_data(
                {
                    "roads": [
                        {
                            "road_id": "VEDAS-ROAD-CAUSEWAY-02",
                            "name": "Sevan River Causeway (Raster Verified)",
                            "elevation_m": min_elev,
                            "geometry": {"type": "LineString", "coordinates": [[77.035, 23.082], [77.062, 23.091]]},
                        },
                        {
                            "road_id": "VEDAS-CORRIDOR-RIDGE-01",
                            "name": "Cartosat Ridge Corridor (Raster Verified)",
                            "elevation_m": mean_elev + 25.0,
                            "geometry": {"type": "LineString", "coordinates": [[77.032, 23.085], [77.016, 23.0805]]},
                        },
                    ]
                },
                source_origin=source_origin,
                water_depth_m=water_depth_m,
                rainfall_mm_hr=4.8,
            )
        except Exception as e:
            logger.error(f"Failed to read Cartosat GeoTIFF raster ({e}): falling back to vector profiles.")
            return []

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
