import logging
from typing import Any, Dict
from app.models.schemas import (
    AssetType,
    HazardSeverity,
    SpatialLayer,
)
from app.models.state import state_store

logger = logging.getLogger("terrapulse.services.bhuvan")


class BhuvanService:
    """
    Bhuvan (National Remote Sensing Centre - NRSC, ISRO Hyderabad) Cadastral Service
    Primary Mission: 1:50,000 LULC Vector Maps, Panchayat Boundaries, Critical Facility Points of Interest (POI).
    Operational Role: Multi-hazard spatial triage of healthcare centers, shelters, schools, and reservoirs.
    """

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
                props.recommended_action = (
                    "Secondary emergency relief center on standby (Capacity: 650)."
                )

            # 5. Hydrological Dam / Reservoir (Kolar Feeder)
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

        logger.info(f"Bhuvan assets evaluated: {assets_evaluated} assets updated (is_emergency={is_emergency})")
        return {
            "assets_evaluated": assets_evaluated,
            "emergency_mode": is_emergency,
            "primary_shelter": "VIT Bhopal Auditorium (Capacity: 2,500)",
        }


bhuvan_service = BhuvanService()
