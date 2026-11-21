import logging
from typing import Any, Dict
from fastapi import APIRouter, HTTPException, status

from app.config import settings
from app.models.schemas import TerraPulseStateResponse
from app.models.state import state_store

logger = logging.getLogger("terrapulse.api.state")
router = APIRouter(tags=["State & Telemetry"])


@router.get(
    "/health",
    summary="System Health & Space Portal Connectivity",
    response_model=Dict[str, Any],
)
async def health_check() -> Dict[str, Any]:
    """
    Returns operational health status, connected ISRO portal backhaul status,
    and tactical mesh radio readiness.
    """
    features_count = len(state_store.features_collection.features) if state_store.features_collection else 0
    return {
        "status": "HEALTHY",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.APP_ENV,
        "mode": state_store.mode,
        "portals": {
            "MOSDAC": "ONLINE (INSAT-3DS TIR1 / GSMaP 0.1 deg)",
            "Bhoonidhi": "ONLINE (EOS-04 / NISAR Level-2B ARD)",
            "VEDAS": "ONLINE (Cartosat High-Res DEM Hydrology)",
            "Bhuvan": "ONLINE (NRSC Cadastral Infrastructure WFS)",
        },
        "tactical_mesh": {
            "lora_frequency_mhz": settings.LORA_FREQUENCY_MHZ,
            "lora_band_mhz": "865–867 (India ISM)",
            "navic_locked": state_store.navic_locked,
            "lora_mesh_active": state_store.lora_mesh_active,
        },
        "features_loaded": features_count,
        "payload_kb": state_store.calculate_payload_kb(),
    }


@router.get(
    "/api/state",
    summary="Central Command Unified Spatial State",
    response_model=TerraPulseStateResponse,
    response_model_exclude_none=True,
)
async def get_state() -> TerraPulseStateResponse:
    """
    Retrieves the complete space-to-ground fused situational state:
    - GeoJSON FeatureCollection across all 5 spatial layers
    - Dynamic payload budget in Kilobytes (<100 KB target)
    - Active NavIC + LoRa distress SOS beacons
    - Dry evacuation corridor dispatch vectors
    - Summary operational KPIs
    """
    try:
        return state_store.get_state_response()
    except Exception as e:
        logger.error(f"Error compiling state response: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to generate situational state: {str(e)}",
        )


@router.post(
    "/api/state/reset",
    summary="Reset State to Baseline",
    response_model=TerraPulseStateResponse,
    response_model_exclude_none=True,
)
async def reset_state() -> TerraPulseStateResponse:
    """
    Resets the state store to the seeded baseline catchment configuration.
    """
    state_store.reset_to_baseline()
    return state_store.get_state_response()
