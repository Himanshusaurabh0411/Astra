import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from app.services.portal_io import read_portal, sample_paths

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
        anomaly_detected = max_rain > self.threshold_mm_hr

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

    def load_records(
        self, override_url: str | None = None, override_path: Path | None = None, nationwide: bool = False,
    ) -> tuple[list[GeoJsonFeature], str]:
        paths = [override_path] if override_path else sample_paths(
            settings.MOSDAC_SAMPLE_PATH, settings.resolve_mosdac_sample_path(), "pan_india_rain.geojson", nationwide,
        )
        return read_portal(
            "MOSDAC", (SpatialLayer.MOSDAC_RAIN,), override_url or settings.MOSDAC_API_URL,
            settings.MOSDAC_API_TOKEN, paths, self._decode_rainfall,
        )

    def ingest_rainfall_data(
        self, override_url: str | None = None, override_path: Path | None = None,
    ) -> dict:
        features, source = self.load_records(override_url, override_path)
        if not features:
            features = self._fallback_seed_records()
        self._apply_features_to_store(features, source)
        return self._build_ingestion_summary(features, source)

    def _decode_rainfall(self, document: dict, source: str, extension: str) -> list[GeoJsonFeature]:
        raw = document.get("records") or document.get("features") or [document]
        records = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            rec = {**item, **(item.get("properties") or {})}
            rainfall = rec.get("rainfall_rate_mm_hr", rec.get("rainfall_mm_hr"))
            geometry = rec.get("geometry") or {}
            coords = geometry.get("coordinates") or rec.get("coordinates")
            if rainfall is None or not coords:
                continue
            if extension == ".csv" and geometry.get("type") == "Point":
                lng, lat = coords
                coords = [[
                    [lng - .03, lat - .03], [lng + .03, lat - .03],
                    [lng + .03, lat + .03], [lng - .03, lat + .03], [lng - .03, lat - .03],
                ]]
            records.append({
                **rec, "coordinates": coords, "rainfall_rate_mm_hr": rainfall,
                "grid_id": rec.get("grid_id") or rec.get("id"),
                "zone_name": rec.get("zone_name") or rec.get("basin_zone") or rec.get("title") or rec.get("name"),
            })
        return self._normalize_json_records({"records": records}, source)

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
            if not 0 <= rain_rate <= 500:
                continue
            is_breached = rain_rate > self.threshold_mm_hr
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
                    place_name=rec.get("place_name"),
                    observed_at=rec.get("observed_at") or rec.get("timestamp"),
                    wind_km_hr=rec.get("wind_km_hr"),
                    soil_moisture_pct=rec.get("soil_moisture_pct"),
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
        if max_rain > self.threshold_mm_hr:
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
        breached = max_rain > self.threshold_mm_hr
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
            HazardSeverity.HIGH if new_peak > self.threshold_mm_hr else HazardSeverity.MODERATE
        )

        for feature in state_store.features_collection.features:
            if feature.properties.layer == SpatialLayer.MOSDAC_RAIN:
                feature.properties.rainfall_mm_hr = new_peak
                feature.properties.severity = severity
                feature.properties.hazard_type = "FLASH_FLOOD_CLOUD_BURST" if new_peak > self.threshold_mm_hr else "MONSOON_RAIN"
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
