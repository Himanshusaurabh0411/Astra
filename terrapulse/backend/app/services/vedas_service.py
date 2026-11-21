import logging
from typing import Any, Dict
from app.models.schemas import (
    HazardSeverity,
    RoadStatus,
    ScenarioMode,
    SpatialLayer,
)
from app.models.state import state_store

logger = logging.getLogger("terrapulse.services.vedas")


class VedasService:
    """
    VEDAS (Visualisation of Earth Data and Archival System - SAC, Ahmedabad) Hydrological DEM Service
    Primary Mission: Cartosat High-Resolution DEM (Digital Elevation Model), STAL Cadastral AI.
    Operational Role: Topographical elevation and drainage slope modeling for road network accessibility.
    Decision Logic: Compares modeled water runoff depth against road surface elevation:
      - Low causeways (<465m elev) are classified as SUBMERGED when river crest rises.
      - Cartosat DEM ridge crests (>510m elev) are classified as dry CORRIDOR evacuation paths.
    """

    def evaluate_roads_and_corridors(self, water_depth_m: float, rainfall_mm_hr: float) -> Dict[str, Any]:
        """
        Updates vedas_roads and vedas_corridors features based on Cartosat DEM runoff calculations.
        """
        if not state_store.features_collection:
            return {}

        is_flooding = water_depth_m >= 0.8
        submerged_count = 0
        open_corridors_count = 0

        for feature in state_store.features_collection.features:
            props = feature.properties

            # 1. Road Networks
            if props.layer == SpatialLayer.VEDAS_ROADS:
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
                            f"ROAD CLOSED: Sevan River causeway submerged under {props.water_depth_m}m of water. "
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

        logger.info(f"VEDAS routing updated: submerged_roads={submerged_count}, open_corridors={open_corridors_count}")
        return {
            "submerged_roads": submerged_count,
            "open_corridors": open_corridors_count,
            "causeway_status": "SUBMERGED" if is_flooding else "OPEN",
        }


vedas_service = VedasService()
