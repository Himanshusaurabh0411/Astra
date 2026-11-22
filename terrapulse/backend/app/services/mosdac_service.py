import csv
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

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

logger = logging.getLogger("terrapulse.services.mosdac")


class MosdacService:
    """
    MOSDAC (Space Applications Centre, ISRO Ahmedabad) Ingestion & Nowcasting Service
    Primary Mission: INSAT-3D / 3DR / 3DS (TIR1 & Sounder), GSMaP_ISRO hourly precipitation (0.1°).
    Operational Role: 0–6h advance convective cloudburst nowcasting.
    Trigger Threshold: >= 15.0 mm/hr convective rainfall rate automates SAR tasking and hydrological warning.

    Ingestion Tiers:
      1. Live Portal URL (settings.MOSDAC_API_URL or custom endpoint)
      2. Local Real Sample File (JSON/CSV in data/real_samples/mosdac/)
      3. Seeded Baseline Catchment Fallback
    """

    def __init__(self):
        self.threshold_mm_hr = settings.RAINFALL_THRESHOLD_MM_HR
        self.last_source_origin: str = "seed_fallback"

    def evaluate_rainfall_features(self) -> Dict[str, Any]:
        """
        Inspects all mosdac_rain features in the state store and checks for threshold breaches.
        """
        if not state_store.features_collection:
            return {
                "features_evaluated": 0,
                "max_rainfall_mm_hr": 0.0,
                "threshold_mm_hr": self.threshold_mm_hr,
                "anomaly_detected": False,
                "sar_tasking_recommended": False,
                "severity": HazardSeverity.LOW,
                "data_source_origin": self.last_source_origin,
            }

        rain_features = [
            f for f in state_store.features_collection.features
            if f.properties.layer == SpatialLayer.MOSDAC_RAIN
        ]
        max_rain = max((f.properties.rainfall_mm_hr for f in rain_features), default=0.0)
        anomaly_detected = max_rain >= self.threshold_mm_hr

        return {
            "features_evaluated": len(rain_features),
            "max_rainfall_mm_hr": max_rain,
            "threshold_mm_hr": self.threshold_mm_hr,
            "anomaly_detected": anomaly_detected,
            "sar_tasking_recommended": anomaly_detected,
            "severity": HazardSeverity.CRITICAL if max_rain >= 35.0 else (
                HazardSeverity.HIGH if anomaly_detected else HazardSeverity.LOW
            ),
            "data_source_origin": self.last_source_origin,
        }

    def ingest_rainfall_data(
        self,
        override_url: Optional[str] = None,
        override_path: Optional[Path] = None,
    ) -> Dict[str, Any]:
        """
        Ingests real-world or sample meteorological rainfall data with automatic fallback.
        Updates state_store features_collection with normalized mosdac_rain features.
        """
        target_url = override_url or settings.MOSDAC_API_URL
        target_path = override_path or settings.resolve_mosdac_sample_path()

        # Tier 1: Try Live MOSDAC Portal Endpoint
        if target_url:
            try:
                logger.info(f"Attempting Tier 1 fetch from MOSDAC live endpoint: {target_url}")
                with httpx.Client(timeout=4.0) as client:
                    resp = client.get(target_url)
                    if resp.status_code == 200:
                        data = resp.json()
                        features = self._normalize_json_records(data, source_origin="live_portal")
                        if features:
                            self._apply_features_to_store(features, source_origin="live_portal")
                            return self._build_ingestion_summary(features, source_origin="live_portal")
            except Exception as e:
                logger.warning(f"Tier 1 live MOSDAC fetch failed ({e}). Falling back to Tier 2 local sample.")

        # Tier 2: Try Real Local Sample Drop
        if target_path and target_path.exists():
            try:
                logger.info(f"Attempting Tier 2 load from local MOSDAC sample: {target_path}")
                if target_path.suffix.lower() == ".json":
                    with open(target_path, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    features = self._normalize_json_records(data, source_origin="local_sample")
                elif target_path.suffix.lower() == ".csv":
                    features = self._normalize_csv_records(target_path, source_origin="local_sample")
                else:
                    features = []

                if features:
                    self._apply_features_to_store(features, source_origin="local_sample")
                    return self._build_ingestion_summary(features, source_origin="local_sample")
            except Exception as e:
                logger.warning(f"Tier 2 local MOSDAC sample parsing failed ({e}). Falling back to Tier 3 seed.")

        # Tier 3: Fallback to Seeded Catchment Baseline
        logger.info("Executing Tier 3 fallback to seeded catchment baseline.")
        features = self._fallback_seed_records()
        self._apply_features_to_store(features, source_origin="seed_fallback")
        return self._build_ingestion_summary(features, source_origin="seed_fallback")

    def _normalize_json_records(self, data: Dict[str, Any], source_origin: str) -> List[GeoJsonFeature]:
        """
        Parses INSAT-3DS product JSON into standard mosdac_rain GeoJsonFeatures.
        """
        records = data.get("records") or data.get("features") or []
        normalized: List[GeoJsonFeature] = []

        for idx, rec in enumerate(records):
            grid_id = rec.get("grid_id") or f"MOSDAC-GRID-{idx+1:02d}"
            zone_name = rec.get("zone_name") or rec.get("name") or "Sehore / Kothri Kalan Basin"
            rain_rate = float(rec.get("rainfall_rate_mm_hr", 0.0))
            is_breached = rain_rate >= self.threshold_mm_hr
            sensor = rec.get("sensor") or "INSAT-3DS TIR1 / Sounder"

            severity = HazardSeverity.CRITICAL if rain_rate >= 35.0 else (
                HazardSeverity.HIGH if is_breached else (
                    HazardSeverity.MODERATE if rain_rate >= 8.0 else HazardSeverity.LOW
                )
            )

            rec_action = (
                f"CRITICAL MOSDAC ALERT: INSAT-3DS precipitation rate ({rain_rate} mm/hr) "
                f"exceeds {self.threshold_mm_hr} mm/hr alert threshold. Automated SAR cloud-penetrating water extraction triggered."
                if is_breached else
                f"Normal monsoon precipitation ({rain_rate} mm/hr); telemetry monitoring active."
            )

            # Coordinates handling
            coords = rec.get("coordinates")
            if not coords:
                coords = [
                    [
                        [77.010, 23.070],
                        [77.140, 23.070],
                        [77.140, 23.160],
                        [77.010, 23.160],
                        [77.010, 23.070]
                    ]
                ]

            geom_type = "Polygon" if isinstance(coords[0], list) and isinstance(coords[0][0], list) else "Point"

            feat = GeoJsonFeature(
                id=grid_id,
                type="Feature",
                geometry=GeoJsonGeometry(type=geom_type, coordinates=coords),
                properties=GeoJsonFeatureProperties(
                    layer=SpatialLayer.MOSDAC_RAIN,
                    title=zone_name,
                    hazard_type="FLASH_FLOOD_CLOUD_BURST" if is_breached else "MONSOON_RAIN",
                    severity=severity,
                    rainfall_mm_hr=rain_rate,
                    water_depth_m=0.0,
                    evacuation_priority=4 if is_breached else 1,
                    recommended_action=rec_action,
                    sensor=sensor,
                    data_source_origin=source_origin,
                ),
            )
            normalized.append(feat)

        return normalized

    def _normalize_csv_records(self, csv_path: Path, source_origin: str) -> List[GeoJsonFeature]:
        """
        Parses tabular CSV precipitation observations into standard mosdac_rain GeoJsonFeatures.
        """
        normalized: List[GeoJsonFeature] = []
        with open(csv_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader):
                grid_id = row.get("grid_id") or f"GSMAP-ISRO-{idx+1:02d}"
                zone_name = row.get("basin_zone") or "Catchment Sector"
                rain_rate = float(row.get("rainfall_rate_mm_hr", 0.0))
                lat = float(row.get("lat", 23.10))
                lng = float(row.get("lng", 77.08))
                sensor = row.get("sensor") or "GSMaP_ISRO Combined"

                is_breached = rain_rate >= self.threshold_mm_hr
                severity = HazardSeverity.CRITICAL if rain_rate >= 35.0 else (
                    HazardSeverity.HIGH if is_breached else HazardSeverity.LOW
                )

                # Create a small bounding polygon box around the grid point (~0.04 deg)
                coords = [
                    [
                        [round(lng - 0.03, 4), round(lat - 0.03, 4)],
                        [round(lng + 0.03, 4), round(lat - 0.03, 4)],
                        [round(lng + 0.03, 4), round(lat + 0.03, 4)],
                        [round(lng - 0.03, 4), round(lat + 0.03, 4)],
                        [round(lng - 0.03, 4), round(lat - 0.03, 4)],
                    ]
                ]

                feat = GeoJsonFeature(
                    id=grid_id,
                    type="Feature",
                    geometry=GeoJsonGeometry(type="Polygon", coordinates=coords),
                    properties=GeoJsonFeatureProperties(
                        layer=SpatialLayer.MOSDAC_RAIN,
                        title=zone_name,
                        hazard_type="FLASH_FLOOD_CLOUD_BURST" if is_breached else "MONSOON_RAIN",
                        severity=severity,
                        rainfall_mm_hr=rain_rate,
                        water_depth_m=0.0,
                        evacuation_priority=4 if is_breached else 1,
                        recommended_action=(
                            f"CRITICAL MOSDAC ALERT: Precipitation rate ({rain_rate} mm/hr) "
                            f"exceeds {self.threshold_mm_hr} mm/hr alert threshold."
                            if is_breached else f"Observation within normal limits ({rain_rate} mm/hr)."
                        ),
                        sensor=sensor,
                        data_source_origin=source_origin,
                    ),
                )
                normalized.append(feat)

        return normalized

    def _fallback_seed_records(self) -> List[GeoJsonFeature]:
        """
        Extracts or generates baseline mosdac_rain features from the state store.
        """
        if state_store.features_collection:
            existing = [
                f for f in state_store.features_collection.features
                if f.properties.layer == SpatialLayer.MOSDAC_RAIN
            ]
            if existing:
                for f in existing:
                    f.properties.data_source_origin = "seed_fallback"
                return existing

        # Synthetic fallback if store empty
        return [
            GeoJsonFeature(
                id="MOSDAC-RAIN-CELL-01",
                type="Feature",
                geometry=GeoJsonGeometry(
                    type="Polygon",
                    coordinates=[
                        [
                            [77.010, 23.070],
                            [77.160, 23.070],
                            [77.160, 23.180],
                            [77.010, 23.180],
                            [77.010, 23.070]
                        ]
                    ]
                ),
                properties=GeoJsonFeatureProperties(
                    layer=SpatialLayer.MOSDAC_RAIN,
                    title="Kothri Kalan South / Sevan Catchment Rain Grid",
                    hazard_type="MONSOON_RAIN",
                    severity=HazardSeverity.LOW,
                    rainfall_mm_hr=4.8,
                    water_depth_m=0.0,
                    evacuation_priority=1,
                    recommended_action="Baseline rainfall within safe threshold (<15 mm/hr).",
                    sensor="INSAT-3DS Imager TIR1",
                    data_source_origin="seed_fallback",
                )
            )
        ]

    def _apply_features_to_store(self, new_features: List[GeoJsonFeature], source_origin: str) -> None:
        """
        Updates state_store.features_collection with the new mosdac_rain features.
        """
        self.last_source_origin = source_origin
        if not state_store.features_collection:
            return

        for f in new_features:
            f.properties.data_source_origin = source_origin
            f.properties.source_portal = "MOSDAC"

        # Keep all non-MOSDAC features
        retained = [
            f for f in state_store.features_collection.features
            if f.properties.layer != SpatialLayer.MOSDAC_RAIN
        ]
        state_store.features_collection.features = new_features + retained

        # Update layer provenance
        state_store.update_layer_provenance(
            layer="mosdac_rain",
            source_portal="MOSDAC",
            ingestion_mode=source_origin,
            sensor="INSAT-3DS Imager TIR1 / GSMaP_ISRO",
            features_count=len(new_features),
        )

        # Check for rain breach
        max_rain = max((f.properties.rainfall_mm_hr for f in new_features), default=0.0)
        if max_rain >= self.threshold_mm_hr:
            state_store.features_collection.metadata.scenario_mode = ScenarioMode.MOSDAC_RAIN_ALERT
            self._trigger_downstream_cascade(max_rain, source_origin)

        # Recalculate payload size in KB
        state_store.enforce_payload_budget(settings.MAX_VECTOR_PAYLOAD_KB)

    def _trigger_downstream_cascade(self, rain_rate: float, source_origin: str) -> None:
        """Automatically cascades rainfall breach into Bhoonidhi, VEDAS, and Bhuvan."""
        try:
            from app.services.bhoonidhi_service import bhoonidhi_service
            from app.services.vedas_service import vedas_service
            from app.services.bhuvan_service import bhuvan_service

            bhoonidhi_res = bhoonidhi_service.evaluate_flood_inundation(rain_rate)
            water_depth = bhoonidhi_res.get("peak_water_depth_m", 1.8)
            vedas_service.evaluate_roads_and_corridors(water_depth_m=water_depth, rainfall_mm_hr=rain_rate)
            bhuvan_service.evaluate_critical_infrastructure(rainfall_mm_hr=rain_rate, flood_depth_m=water_depth)
        except Exception as e:
            logger.error(f"Downstream cascade after MOSDAC breach failed ({e})", exc_info=True)

    def _build_ingestion_summary(self, features: List[GeoJsonFeature], source_origin: str) -> Dict[str, Any]:
        """
        Builds standardized metadata response dictionary for the ingestion operation.
        """
        max_rain = max((f.properties.rainfall_mm_hr for f in features), default=0.0)
        breached = max_rain >= self.threshold_mm_hr
        return {
            "source_origin": source_origin,
            "features_ingested": len(features),
            "max_rainfall_mm_hr": max_rain,
            "threshold_mm_hr": self.threshold_mm_hr,
            "anomaly_detected": breached,
            "sar_tasking_recommended": breached,
            "scenario_mode": state_store.features_collection.metadata.scenario_mode.value if state_store.features_collection else "BASELINE",
        }

    def trigger_rainfall_spike(self, multiplier: float = 4.0, target_rain_mm_hr: float = None) -> float:
        """
        Simulates an intense convective cloudburst cell over the Kothri Kalan / Sehore catchment basin.
        Updates mosdac_rain features, sets scenario mode to MOSDAC_RAIN_ALERT, and returns new peak rainfall rate.
        """
        if not state_store.features_collection:
            return 0.0

        new_peak = target_rain_mm_hr if target_rain_mm_hr is not None else round(4.8 * multiplier, 1)
        severity = HazardSeverity.CRITICAL if new_peak >= 35.0 else (
            HazardSeverity.HIGH if new_peak >= self.threshold_mm_hr else HazardSeverity.MODERATE
        )

        for feature in state_store.features_collection.features:
            if feature.properties.layer == SpatialLayer.MOSDAC_RAIN:
                feature.properties.rainfall_mm_hr = new_peak
                feature.properties.severity = severity
                feature.properties.hazard_type = "FLASH_FLOOD_CLOUD_BURST" if new_peak >= self.threshold_mm_hr else "MONSOON_RAIN"
                feature.properties.recommended_action = (
                    f"CRITICAL MOSDAC ALERT: Intense convective precipitation ({new_peak} mm/hr) "
                    f"exceeds {self.threshold_mm_hr} mm/hr threshold. Automated SAR acquisition triggered."
                )
                feature.properties.data_source_origin = "simulation_spike"
                feature.properties.source_portal = "MOSDAC"

        # Update metadata scenario mode
        state_store.features_collection.metadata.scenario_mode = ScenarioMode.MOSDAC_RAIN_ALERT
        self.last_source_origin = "simulation_spike"
        state_store.update_layer_provenance(
            layer="mosdac_rain",
            source_portal="MOSDAC",
            ingestion_mode="simulation_spike",
            sensor="INSAT-3DS Imager TIR1 / GSMaP_ISRO",
        )
        logger.info(f"MOSDAC rainfall spike triggered: peak={new_peak} mm/hr, severity={severity}")
        return new_peak


mosdac_service = MosdacService()
