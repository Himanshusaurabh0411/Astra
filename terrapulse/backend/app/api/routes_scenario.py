import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.ws_live import ws_manager
from app.models.schemas import OperationalMode, ScenarioMode, TerraPulseStateResponse
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
        # 1. Execute unified space-to-ground cascade through TerraPulseStateStore
        cascade_summary = state_store.execute_cascade(
            rainfall_mm_hr=req.rainfall_mm_hr,
            multiplier=req.multiplier,
            trigger_source="simulation_spike",
        )

        # 2. Compile State Response with payload budget strictly enforced (<100 KB)
        state_response = state_store.get_state_response()

        # 3. WebSocket Live Event Broadcast
        await ws_manager.broadcast("state_updated", {
            "mode": state_response.mode,
            "kpis": state_response.kpis.model_dump(),
            "payload_kb": state_response.payload_kb,
            "rainfall_mm_hr": cascade_summary.get("rainfall_mm_hr", 19.2),
            "water_depth_m": cascade_summary.get("peak_water_depth_m", 1.8),
            "cascade": cascade_summary,
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
    if req.mode == OperationalMode.CELL_BLACKOUT_MESH_ACTIVE and state_store.features_collection:
        state_store.features_collection.metadata.scenario_mode = ScenarioMode.TELECOM_BLACKOUT_MESH

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


@router.post(
    "/portal/mosdac/ingest",
    summary="Ingest Real/Sample MOSDAC Meteorological Precipitation Data",
    tags=["Scenario Control & Multi-Portal GeoAI Engine"],
)
async def ingest_mosdac_data(override_url: Optional[str] = None) -> Dict[str, Any]:
    """
    Ingests real meteorological data from MOSDAC API or local INSAT-3DS/GSMaP samples.
    Falls back gracefully to seeded catchment baseline if portal is unavailable.
    """
    summary = mosdac_service.ingest_rainfall_data(override_url=override_url)
    state_response = state_store.get_state_response()

    await ws_manager.broadcast("mosdac_ingested", {
        "summary": summary,
        "kpis": state_response.kpis.model_dump(),
        "payload_kb": state_response.payload_kb,
    })
    return summary


@router.post(
    "/portal/vedas/ingest",
    summary="Ingest Real/Sample VEDAS Cartosat DEM Road & Drainage Profile",
    tags=["Scenario Control & Multi-Portal GeoAI Engine"],
)
async def ingest_vedas_data(
    water_depth_m: float = 0.0,
    rainfall_mm_hr: float = 4.8,
) -> Dict[str, Any]:
    """
    Ingests Cartosat DEM elevation profiles and calculates road submergence vs safe ridge corridors.
    """
    summary = vedas_service.ingest_terrain_and_roads(
        water_depth_m=water_depth_m,
        rainfall_mm_hr=rainfall_mm_hr,
    )
    state_response = state_store.get_state_response()

    await ws_manager.broadcast("vedas_ingested", {
        "summary": summary,
        "kpis": state_response.kpis.model_dump(),
        "payload_kb": state_response.payload_kb,
    })
    return summary


@router.get(
    "/portal/vedas/agri-stress",
    summary="Get VEDAS Catchment Crop Condition & PMFBY Parametric Loss Summary",
    tags=["Scenario Control & Multi-Portal GeoAI Engine"],
)
async def get_vedas_agri_stress() -> Dict[str, Any]:
    """
    Returns VEDAS agricultural drought, NDVI anomaly, and PMFBY parametric insurance eligibility.
    """
    return vedas_service.get_crop_stress_summary()


@router.post(
    "/portal/bhoonidhi/ingest",
    summary="Ingest Real/Sample Bhoonidhi EOS-04 SAR Flood Inundation Data",
    tags=["Scenario Control & Multi-Portal GeoAI Engine"],
)
async def ingest_bhoonidhi_data(
    override_url: Optional[str] = None,
    rainfall_mm_hr: float = 16.5,
) -> Dict[str, Any]:
    """
    Ingests real/sample EOS-04 C-band SAR all-weather flood extraction polygons.
    """
    summary = bhoonidhi_service.ingest_sar_flood_data(
        override_url=override_url,
        rainfall_mm_hr=rainfall_mm_hr,
    )
    state_response = state_store.get_state_response()

    await ws_manager.broadcast("bhoonidhi_ingested", {
        "summary": summary,
        "kpis": state_response.kpis.model_dump(),
        "payload_kb": state_response.payload_kb,
    })
    return summary


@router.post(
    "/portal/bhuvan/ingest",
    summary="Ingest Real/Sample Bhuvan Cadastral Facilities & POI Data",
    tags=["Scenario Control & Multi-Portal GeoAI Engine"],
)
async def ingest_bhuvan_data(
    override_url: Optional[str] = None,
    rainfall_mm_hr: float = 4.8,
    flood_depth_m: float = 0.0,
) -> Dict[str, Any]:
    """
    Ingests critical facility points (hospitals, shelters, muster posts, schools, dams)
    and evaluates multi-hazard exposure.
    """
    summary = bhuvan_service.ingest_critical_facilities(
        override_url=override_url,
        rainfall_mm_hr=rainfall_mm_hr,
        flood_depth_m=flood_depth_m,
    )
    state_response = state_store.get_state_response()

    await ws_manager.broadcast("bhuvan_ingested", {
        "summary": summary,
        "kpis": state_response.kpis.model_dump(),
        "payload_kb": state_response.payload_kb,
    })
    return summary


@router.get(
    "/portal/bhuvan/waterbodies",
    summary="Get Bhuvan Catchment Water Bodies & Reservoir Surcharge Status",
    tags=["Scenario Control & Multi-Portal GeoAI Engine"],
)
async def get_bhuvan_waterbodies() -> Dict[str, Any]:
    """
    Returns Bhuvan National Water Body Information System reservoir levels and storage status.
    """
    return bhuvan_service.get_waterbody_summary()

