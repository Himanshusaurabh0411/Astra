import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx

from app.config import settings
from app.models.schemas import (
    AssetType,
    GeoJsonFeature,
    GeoJsonFeatureProperties,
    GeoJsonGeometry,
    HazardSeverity,
    SpatialLayer,
)
from app.models.state import state_store

logger = logging.getLogger("terrapulse.services.bhuvan")


class BhuvanService:
    """
    Bhuvan (National Remote Sensing Centre - NRSC, ISRO Hyderabad) Cadastral & POI Service
    Primary Mission: 1:50,000 LULC Vector Maps, Panchayat Boundaries, Critical Facility Points of Interest (POI).
    Operational Role: Multi-hazard spatial triage of healthcare centers, shelters, schools, and reservoirs.

    Ingestion Tiers:
      1. Live Bhuvan OGC WFS / REST API Endpoint (settings.BHUVAN_WFS_URL)
      2. Local Real Sample Drop (GeoJSON / JSON in data/real_samples/bhuvan/)
      3. Seeded Baseline Catchment Fallback
    """

    def __init__(self):
        self.last_source_origin: str = "seed_fallback"
        self._cached_waterbodies: List[Dict[str, Any]] = []

    def evaluate_critical_infrastructure(self, rainfall_mm_hr: float, flood_depth_m: float) -> Dict[str, Any]:
        """
        Updates bhuvan_assets points with real-time operational status, priority, and emergency recommendations.
        """
        if not state_store.features_collection:
            return {}

        is_emergency = rainfall_mm_hr >= 15.0 or flood_depth_m >= 0.8
        assets_evaluated = 0

        for feature in state_store.features_collection.features:
            props = feature.properties
            if props.layer != SpatialLayer.BHUVAN_ASSETS:
                continue

            assets_evaluated += 1
            props.source_portal = "Bhuvan"
            props.data_source_origin = self.last_source_origin
            props.rainfall_mm_hr = rainfall_mm_hr

            # 1. Hospital (CHC Kothri Kalan)
            if props.asset_type == AssetType.HOSPITAL:
                if is_emergency:
                    props.severity = HazardSeverity.HIGH
                    props.evacuation_priority = 3
                    props.water_depth_m = 0.05
                    props.recommended_action = (
                        "EMERGENCY MEDICAL TRIAGE ACTIVE: CHC Kothri Kalan (60 beds) primed for flash flood trauma "
                        "and waterborne casualty intake. Power switched to backup generator."
                    )
                else:
                    props.severity = HazardSeverity.LOW
                    props.evacuation_priority = 1
                    props.water_depth_m = 0.0
                    props.recommended_action = "Primary regional emergency trauma and medical triage facility (Capacity: 60 beds)."

            # 2. Designated Primary Relief Shelter (VIT Bhopal Auditorium)
            elif props.asset_type == AssetType.SHELTER:
                props.water_depth_m = 0.0
                props.severity = HazardSeverity.LOW
                props.evacuation_priority = 1
                if is_emergency:
                    props.recommended_action = (
                        "PRIMARY EVACUATION DESTINATION ACTIVE: VIT Bhopal Auditorium high-ground shelter (Cap: 2,500) "
                        "open with food rations, clean drinking water, captive solar microgrid, and medical staging."
                    )
                else:
                    props.recommended_action = (
                        "Designated high-ground multi-purpose cyclone/flood shelter with auxiliary solar & captive DG backup (Capacity: 2,500)."
                    )

            # 3. Local Administrative Base (Gram Panchayat)
            elif props.asset_type == AssetType.GRAM_PANCHAYAT:
                props.severity = HazardSeverity.MODERATE if is_emergency else HazardSeverity.LOW
                props.water_depth_m = 0.1 if is_emergency else 0.0
                props.evacuation_priority = 2
                props.recommended_action = (
                    "LoRa Tactical Mesh ground relay station and community disaster muster post active."
                    if is_emergency else "Local disaster volunteer staging center and LoRa mesh ground relay station."
                )

            # 4. Secondary Evacuation Center (School)
            elif props.asset_type == AssetType.SCHOOL:
                props.severity = HazardSeverity.MODERATE if is_emergency else HazardSeverity.LOW
                props.water_depth_m = 0.0
                props.evacuation_priority = 2
                props.recommended_action = "Secondary emergency relief center on standby (Capacity: 650)."

            # 5. Hydrological Dam / Reservoir (Sevan Checkdam)
            elif props.asset_type == AssetType.RESERVOIR:
                if is_emergency:
                    props.severity = HazardSeverity.CRITICAL
                    props.water_depth_m = round(flood_depth_m * 1.2, 2)
                    props.evacuation_priority = 4
                    props.recommended_action = (
                        "RESERVOIR SURCHARGE WARNING: Inflow spike detected. Automated sluice gates prepared for "
                        "controlled discharge. Downstream low-lying riparian settlements placed on alert."
                    )
                else:
                    props.severity = HazardSeverity.LOW
                    props.water_depth_m = 0.0
                    props.evacuation_priority = 1
                    props.recommended_action = "Reservoir live storage nominal; automated sluice telemetry operating nominal."

        state_store.update_layer_provenance(
            layer="bhuvan_assets",
            source_portal="Bhuvan",
            ingestion_mode=self.last_source_origin,
            sensor="NRSC Cadastral Infrastructure WFS",
        )
        state_store.enforce_payload_budget(settings.MAX_VECTOR_PAYLOAD_KB)
        logger.info(f"Bhuvan assets evaluated: {assets_evaluated} assets updated (is_emergency={is_emergency})")
        return {
            "assets_evaluated": assets_evaluated,
            "emergency_mode": is_emergency,
            "primary_shelter": "VIT Bhopal Auditorium (Capacity: 2,500)",
            "data_source_origin": self.last_source_origin,
        }

    def ingest_critical_facilities(
        self,
        override_url: Optional[str] = None,
        override_path: Optional[Path] = None,
        rainfall_mm_hr: float = 4.8,
        flood_depth_m: float = 0.0,
    ) -> Dict[str, Any]:
        """
        Ingests real-world or sample Bhuvan infrastructure POIs with 3-tier fallback.
        """
        target_url = override_url or settings.BHUVAN_WFS_URL
        target_path = override_path or settings.resolve_bhuvan_sample_path()

        # Tier 1: Live Bhuvan OGC WFS / API Endpoint
        if target_url:
            try:
                logger.info(f"Attempting Tier 1 fetch from Bhuvan WFS endpoint: {target_url}")
                with httpx.Client(timeout=4.0) as client:
                    resp = client.get(target_url)
                    if resp.status_code == 200:
                        data = resp.json()
                        features = self._normalize_facility_geojson(data, source_origin="live_portal", rainfall_mm_hr=rainfall_mm_hr, flood_depth_m=flood_depth_m)
                        if features:
                            self._apply_asset_features_to_store(features, source_origin="live_portal")
                            return self._build_ingestion_summary(features, source_origin="live_portal")
            except Exception as e:
                logger.warning(f"Tier 1 live Bhuvan fetch failed ({e}). Falling back to Tier 2 local sample.")

        # Tier 2: Real Local Sample Drop
        if target_path and target_path.exists():
            try:
                logger.info(f"Attempting Tier 2 load from local Bhuvan sample: {target_path}")
                with open(target_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                features = self._normalize_facility_geojson(data, source_origin="local_sample", rainfall_mm_hr=rainfall_mm_hr, flood_depth_m=flood_depth_m)
                if features:
                    self._apply_asset_features_to_store(features, source_origin="local_sample")
                    return self._build_ingestion_summary(features, source_origin="local_sample")
            except Exception as e:
                logger.warning(f"Tier 2 local Bhuvan sample parsing failed ({e}). Falling back to Tier 3 seed.")

        # Tier 3: Fallback to Seed Catchment Baseline
        logger.info("Executing Tier 3 fallback to Bhuvan seeded baseline.")
        self.last_source_origin = "seed_fallback"
        eval_res = self.evaluate_critical_infrastructure(rainfall_mm_hr, flood_depth_m)
        return {
            "source_origin": "seed_fallback",
            "assets_evaluated": eval_res.get("assets_evaluated", 5),
            "emergency_mode": eval_res.get("emergency_mode", False),
            "primary_shelter": eval_res.get("primary_shelter", "VIT Bhopal Auditorium"),
            "scenario_mode": state_store.features_collection.metadata.scenario_mode.value if state_store.features_collection else "BASELINE",
        }

    def _normalize_facility_geojson(
        self,
        data: Dict[str, Any],
        source_origin: str,
        rainfall_mm_hr: float,
        flood_depth_m: float,
    ) -> List[GeoJsonFeature]:
        """
        Parses Bhuvan facility GeoJSON features and scores exposure against flood depth and rainfall.
        """
        raw_features = data.get("features") or []
        normalized: List[GeoJsonFeature] = []
        is_emergency = rainfall_mm_hr >= 15.0 or flood_depth_m >= 0.8

        type_map = {
            "HOSPITAL": AssetType.HOSPITAL,
            "SHELTER": AssetType.SHELTER,
            "GRAM_PANCHAYAT": AssetType.GRAM_PANCHAYAT,
            "SCHOOL": AssetType.SCHOOL,
            "RESERVOIR": AssetType.RESERVOIR,
        }

        for idx, rf in enumerate(raw_features):
            fid = rf.get("id") or f"BHUVAN-ASSET-{idx+1:02d}"
            props = rf.get("properties") or {}
            geom = rf.get("geometry") or {}

            raw_type = str(props.get("asset_type", "NONE")).upper()
            asset_type = type_map.get(raw_type, AssetType.NONE)
            title = props.get("title") or props.get("name") or "Critical Infrastructure Facility"
            elev_m = float(props.get("elevation_m", 480.0))
            cap = int(props.get("capacity")) if props.get("capacity") else None

            # Multi-hazard triage logic
            if asset_type == AssetType.HOSPITAL:
                severity = HazardSeverity.HIGH if is_emergency else HazardSeverity.LOW
                evac_priority = 3 if is_emergency else 1
                rec_action = (
                    "EMERGENCY MEDICAL TRIAGE ACTIVE: 60-bed facility primed for flood casualty intake."
                    if is_emergency else "Primary regional medical triage facility (Capacity: 60 beds)."
                )
                water_depth = 0.05 if is_emergency else 0.0
            elif asset_type == AssetType.SHELTER:
                severity = HazardSeverity.LOW
                evac_priority = 1
                water_depth = 0.0
                rec_action = (
                    "PRIMARY HIGH-GROUND EVACUATION SHELTER ACTIVE: VIT Bhopal Auditorium (Cap: 2,500) open with microgrid & supplies."
                    if is_emergency else "Designated high-ground relief shelter (Capacity: 2,500)."
                )
            elif asset_type == AssetType.RESERVOIR:
                severity = HazardSeverity.CRITICAL if is_emergency else HazardSeverity.LOW
                evac_priority = 4 if is_emergency else 1
                water_depth = round(flood_depth_m * 1.2, 2) if is_emergency else 0.0
                rec_action = (
                    "RESERVOIR SURCHARGE WARNING: Sluice telemetry active. Controlled discharge downstream."
                    if is_emergency else "Reservoir live storage nominal."
                )
            elif asset_type == AssetType.GRAM_PANCHAYAT:
                severity = HazardSeverity.MODERATE if is_emergency else HazardSeverity.LOW
                evac_priority = 2
                water_depth = 0.1 if is_emergency else 0.0
                rec_action = "LoRa Tactical Mesh ground relay station and community disaster muster post active."
            else:
                severity = HazardSeverity.LOW
                evac_priority = 1
                water_depth = 0.0
                rec_action = props.get("recommended_action") or "Facility operational."

            coords = geom.get("coordinates") or [77.0580, 23.0910]

            feat = GeoJsonFeature(
                id=fid,
                type="Feature",
                geometry=GeoJsonGeometry(type="Point", coordinates=[round(coords[0], 4), round(coords[1], 4)]),
                properties=GeoJsonFeatureProperties(
                    layer=SpatialLayer.BHUVAN_ASSETS,
                    title=title,
                    hazard_type="NONE" if severity == HazardSeverity.LOW else "MULTI_HAZARD_EXPOSURE",
                    severity=severity,
                    rainfall_mm_hr=rainfall_mm_hr,
                    water_depth_m=water_depth,
                    asset_type=asset_type,
                    elevation_m=elev_m,
                    capacity=cap,
                    evacuation_priority=evac_priority,
                    recommended_action=rec_action,
                    sensor="Bhuvan Cadastral WFS / POI",
                    data_source_origin=source_origin,
                ),
            )
            normalized.append(feat)

        return normalized

    def _apply_asset_features_to_store(self, new_features: List[GeoJsonFeature], source_origin: str) -> None:
        """
        Replaces bhuvan_assets in state_store.features_collection.
        """
        self.last_source_origin = source_origin
        if not state_store.features_collection:
            return

        for f in new_features:
            f.properties.data_source_origin = source_origin
            f.properties.source_portal = "Bhuvan"

        retained = [
            f for f in state_store.features_collection.features
            if f.properties.layer != SpatialLayer.BHUVAN_ASSETS
        ]
        state_store.features_collection.features = retained + new_features

        state_store.update_layer_provenance(
            layer="bhuvan_assets",
            source_portal="Bhuvan",
            ingestion_mode=source_origin,
            sensor="NRSC Cadastral Infrastructure WFS",
            features_count=len(new_features),
        )
        state_store.enforce_payload_budget(settings.MAX_VECTOR_PAYLOAD_KB)

    def _build_ingestion_summary(self, features: List[GeoJsonFeature], source_origin: str) -> Dict[str, Any]:
        """
        Summarizes ingested Bhuvan assets.
        """
        critical_count = sum(1 for f in features if f.properties.severity in (HazardSeverity.HIGH, HazardSeverity.CRITICAL))
        shelter = next((f.properties.title for f in features if f.properties.asset_type == AssetType.SHELTER), "VIT Bhopal Auditorium")
        return {
            "source_origin": source_origin,
            "assets_evaluated": len(features),
            "high_critical_assets": critical_count,
            "primary_shelter": shelter,
            "scenario_mode": state_store.features_collection.metadata.scenario_mode.value if state_store.features_collection else "BASELINE",
        }

    # =========================================================================
    # LULC & Water Body Ingestion
    # =========================================================================

    def ingest_waterbody_inventory(self, override_path: Optional[Path] = None) -> List[Dict[str, Any]]:
        """
        Ingests Bhuvan water body inventory & reservoir storage levels.
        """
        target_path = override_path or settings.resolve_bhuvan_lulc_sample_path()
        if not target_path or not target_path.exists():
            logger.info("Bhuvan waterbody sample not found; returning baseline inventory.")
            return self._fallback_waterbody_records()

        try:
            with open(target_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            wbs = data.get("water_bodies") or []
            self._cached_waterbodies = wbs
            return wbs
        except Exception as e:
            logger.warning(f"Failed to parse Bhuvan waterbody JSON from {target_path} ({e}); using fallback.")
            return self._fallback_waterbody_records()

    def get_waterbody_summary(self) -> Dict[str, Any]:
        """
        Computes aggregate reservoir storage and sluice status across the catchment.
        """
        wbs = self._cached_waterbodies or self.ingest_waterbody_inventory()
        avg_storage = round(
            sum(float(w.get("current_storage_pct", 0.0)) for w in wbs) / max(len(wbs), 1),
            1,
        )
        surcharged = [w.get("name") for w in wbs if float(w.get("current_storage_pct", 0.0)) >= 90.0]

        return {
            "total_waterbodies_monitored": len(wbs),
            "avg_storage_pct": avg_storage,
            "surcharge_alert_reservoirs": surcharged,
            "water_bodies": wbs,
            "data_source_origin": self.last_source_origin,
        }

    def _fallback_waterbody_records(self) -> List[Dict[str, Any]]:
        """
        Baseline water body records.
        """
        return [
            {
                "waterbody_id": "BHUVAN-WB-SEVAN-CHECKDAM",
                "name": "Sevan River Checkdam",
                "type": "BARRAGE_RESERVOIR",
                "full_reservoir_level_m": 464.5,
                "current_storage_pct": 86.4,
                "sluice_status": "MONITORING_HEADWORKS",
            },
            {
                "waterbody_id": "BHUVAN-WB-KERWA-DAM",
                "name": "Kerwa Dam Reservoir (Bhopal)",
                "type": "EARTHEN_MASONRY_DAM",
                "full_reservoir_level_m": 509.9,
                "current_storage_pct": 91.2,
                "sluice_status": "GATES_PRE_OPENED_10_PCT",
            },
        ]


bhuvan_service = BhuvanService()
