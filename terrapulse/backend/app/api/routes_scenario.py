import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.ws_live import ws_manager
from app.models.schemas import OperationalMode, TerraPulseStateResponse
from app.models.state import state_store
from app.services.bhoonidhi_service import bhoonidhi_service
from app.services.bhuvan_service import bhuvan_service
from app.services.mesh_relay_service import mesh_relay_service
from app.services.mosdac_service import mosdac_service
from app.services.vedas_service import vedas_service

logger = logging.getLogger("terrapulse.api.scenario")
router = APIRouter(prefix="/api", tags=["Scenario Control & Multi-Portal GeoAI Engine"])


class RainfallSpikeRequest(BaseModel):
    multiplier: float = Field(default=4.0, ge=1.0, le=20.0, description="Precipitation intensity scaling multiplier")
    rainfall_mm_hr: Optional[float] = Field(default=None, ge=0.0, le=250.0, description="Explicit target rainfall rate in mm/hr")


class ModeChangeRequest(BaseModel):
    mode: OperationalMode = Field(description="Operational connectivity mode")


@router.post(
    "/scenario/rainfall-spike",
    summary="Trigger MOSDAC Convective Rain Spike & Full GeoAI Cascade",
    response_model=TerraPulseStateResponse,
    response_model_exclude_none=True,
)
async def trigger_rainfall_spike(req: RainfallSpikeRequest = RainfallSpikeRequest()) -> TerraPulseStateResponse:
    """
    Simulates a heavy convective cloudburst event over the Kothri Kalan / Sehore basin:
    1. **MOSDAC**: Escalates INSAT-3DS precipitation past the 15.0 mm/hr threshold.
    2. **Bhoonidhi**: Simulates EOS-04/NISAR SAR backscatter drop (<-16.5 dB) and flood expansion along Sevan River.
    3. **VEDAS**: Applies Cartosat DEM runoff, marks low causeway SUBMERGED, keeps high ridge CORRIDOR open.
    4. **Bhuvan**: Triage hospital (CHC Kothri Kalan) and designate VIT Bhopal Auditorium as safe dry shelter.
    5. Broadcasts updated state over WebSocket feed to Central Command and field devices.
    """
    try:
        # 1. MOSDAC Rainfall Spike
        new_rain = mosdac_service.trigger_rainfall_spike(
            multiplier=req.multiplier,
            target_rain_mm_hr=req.rainfall_mm_hr,
        )

        # 2. Bhoonidhi Microwave SAR Inundation Extraction
        bhoonidhi_res = bhoonidhi_service.evaluate_flood_inundation(new_rain)
        water_depth = bhoonidhi_res.get("peak_water_depth_m", 1.8)

        # 3. VEDAS Cartosat DEM Road & Corridor Routing
        vedas_service.evaluate_roads_and_corridors(water_depth_m=water_depth, rainfall_mm_hr=new_rain)

        # 4. Bhuvan Cadastral Asset Triage
        bhuvan_service.evaluate_critical_infrastructure(rainfall_mm_hr=new_rain, flood_depth_m=water_depth)

        # 5. Compile State Response
        state_response = state_store.get_state_response()

        # 6. WebSocket Live Event Broadcast
        await ws_manager.broadcast("state_updated", {
            "mode": state_response.mode,
            "kpis": state_response.kpis.model_dump(),
            "payload_kb": state_response.payload_kb,
            "rainfall_mm_hr": new_rain,
            "water_depth_m": water_depth,
        })

        logger.info(f"Full GeoAI cascade complete. Payload size: {state_response.payload_kb} KB (<100 KB target)")
        return state_response

    except Exception as e:
        logger.error(f"Failed to execute rainfall spike cascade: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"GeoAI rainfall spike simulation failed: {str(e)}",
        )


@router.post(
    "/mode",
    summary="Switch Central Command & Mesh Network Mode",
    response_model=TerraPulseStateResponse,
    response_model_exclude_none=True,
)
async def switch_mode(req: ModeChangeRequest) -> TerraPulseStateResponse:
    """
    Switches system between NORMAL, CELL_BLACKOUT_MESH_ACTIVE, and BACKHAUL_SYNC.
    In CELL_BLACKOUT_MESH_ACTIVE, backhaul is severed and all distress traffic
    routes over NavIC + LoRa 865 MHz peer-to-peer hops.
    """
    mesh_relay_service.switch_operational_mode(req.mode)
    state_response = state_store.get_state_response()

    # WebSocket Broadcast
    await ws_manager.broadcast("mode_changed", {
        "mode": state_response.mode,
        "cellular_online": state_response.kpis.cellular_online,
        "lora_mesh_active": state_response.kpis.lora_mesh_active,
    })

    return state_response


@router.post(
    "/reset",
    summary="Reset State Store to Baseline",
    response_model=TerraPulseStateResponse,
    response_model_exclude_none=True,
)
async def reset_scenario() -> TerraPulseStateResponse:
    """
    Resets the GeoAI state to the seeded baseline catchment configuration.
    """
    state_store.reset_to_baseline()
    state_response = state_store.get_state_response()

    await ws_manager.broadcast("state_reset", {
        "mode": state_response.mode,
        "kpis": state_response.kpis.model_dump(),
    })

    return state_response
