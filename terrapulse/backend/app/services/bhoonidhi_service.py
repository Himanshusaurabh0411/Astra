import logging
from typing import Any, Dict
from app.models.schemas import (
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
    Physics: Backscatter thresholding (< -16.5 dB) isolates specular reflections from standing surface flood water.
    """

    def evaluate_flood_inundation(self, rainfall_mm_hr: float) -> Dict[str, Any]:
        """
        Updates bhoonidhi_flood features based on modeled hydrological runoff from MOSDAC precipitation.
        When rainfall >= 15 mm/hr, standing water expands across the Sevan River floodplain.
        """
        if not state_store.features_collection:
            return {}

        is_severe = rainfall_mm_hr >= 15.0
        # Scaled water depth based on catchment rainfall runoff
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
                feature.properties.recommended_action = (
                    f"BHOONIDHI SAR INUNDATION: Radar backscatter <-16.5 dB detected. "
                    f"Estimated water depth: {new_water_depth}m along Sevan River floodplain."
                    if is_severe else "Normal riverbed channel flow; radar backscatter values nominal."
                )

                # Expand the flood polygon coordinates when flooding occurs
                if is_severe and feature.geometry.type == "Polygon":
                    feature.geometry.coordinates = [
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
                flood_features.append(feature)

        if is_severe and state_store.features_collection.metadata.scenario_mode == ScenarioMode.MOSDAC_RAIN_ALERT:
            state_store.features_collection.metadata.scenario_mode = ScenarioMode.BHOONIDHI_SAR_INUNDATION

        logger.info(f"Bhoonidhi SAR updated: water_depth={new_water_depth}m, severity={severity}")
        return {
            "satellite": "EOS-04 C-band SAR / NISAR",
            "backscatter_threshold_db": -16.5,
            "peak_water_depth_m": new_water_depth,
            "severity": severity,
            "inundation_confirmed": is_severe,
        }


bhoonidhi_service = BhoonidhiService()
