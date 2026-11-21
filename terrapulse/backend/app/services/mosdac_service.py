import logging
from typing import Any, Dict, List
from app.config import settings
from app.models.schemas import (
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
    """

    def __init__(self):
        self.threshold_mm_hr = settings.RAINFALL_THRESHOLD_MM_HR

    def evaluate_rainfall_features(self) -> Dict[str, Any]:
        """
        Inspects all mosdac_rain features in the state store and checks for threshold breaches.
        """
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
            "severity": HazardSeverity.CRITICAL if max_rain >= 40.0 else (
                HazardSeverity.HIGH if anomaly_detected else HazardSeverity.LOW
            ),
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

        # Update metadata scenario mode
        state_store.features_collection.metadata.scenario_mode = ScenarioMode.MOSDAC_RAIN_ALERT
        logger.info(f"MOSDAC rainfall spike triggered: peak={new_peak} mm/hr, severity={severity}")
        return new_peak


mosdac_service = MosdacService()
