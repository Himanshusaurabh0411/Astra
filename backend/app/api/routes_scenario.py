import asyncio
import logging
from typing import Any, Dict, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from app.api.routes_state import reset_state
from app.api.ws_live import ws_manager
from app.models.regions import canonical_region
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
    region: str | None = Field(default=None, max_length=120)
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
        region = canonical_region(req.region)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    target = "central-india" if region == "all-india" else region
    if target == "central-india":
        state_store.execute_cascade(req.rainfall_mm_hr, req.multiplier)
        for feature in state_store.features_collection.features:
            feature.properties.data_source_origin = "simulation_spike"
            feature.properties.observed_at = state_store.last_updated
    else:
        state_store.simulate_region(target, req.rainfall_mm_hr, req.multiplier)

    response = state_store.get_state_response(region)
    await ws_manager.broadcast("state_updated", {
        "reason": "heavy_rain",
        "region": target,
        "rainfall_mm_hr": response.kpis.max_rainfall_mm_hr,
    })
    return response


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
    result = state_store.get_state_response()
    await ws_manager.broadcast("state_updated", {"reason": "mode", "mode": result.mode})
    return result


@router.post(
    "/reset",
    summary="Reset State Store to Baseline",
    response_model=TerraPulseStateResponse,
    response_model_exclude_none=True,
)
async def reset_scenario() -> TerraPulseStateResponse:
    return await reset_state()


@router.post("/ingest/sync", response_model=TerraPulseStateResponse, response_model_exclude_none=True)
async def sync_portals() -> TerraPulseStateResponse:
    loaders = {
        "MOSDAC": mosdac_service.load_records,
        "Bhoonidhi": bhoonidhi_service.load_records,
        "VEDAS": vedas_service.load_records,
        "Bhuvan": bhuvan_service.load_records,
    }
    snapshots = await asyncio.gather(*(
        asyncio.to_thread(load, nationwide=True) for load in loaders.values()
    ))
    state_store.apply_portal_sync(dict(zip(loaders, snapshots)))
    result = state_store.get_state_response()
    await ws_manager.broadcast("state_updated", {"reason": "portal_sync", "mode": result.mode})
    return result


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
    summary = mosdac_service.ingest_rainfall_data()
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
    water_depth_m: float = Query(default=0.0, ge=0, le=100),
    rainfall_mm_hr: float = Query(default=4.8, ge=0, le=500),
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
    rainfall_mm_hr: float = Query(default=16.5, ge=0, le=500),
) -> Dict[str, Any]:
    """
    Ingests real/sample EOS-04 C-band SAR all-weather flood extraction polygons.
    """
    summary = bhoonidhi_service.ingest_sar_flood_data(
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
    rainfall_mm_hr: float = Query(default=4.8, ge=0, le=500),
    flood_depth_m: float = Query(default=0.0, ge=0, le=100),
) -> Dict[str, Any]:
    """
    Ingests critical facility points (hospitals, shelters, muster posts, schools, dams)
    and evaluates multi-hazard exposure.
    """
    summary = bhuvan_service.ingest_critical_facilities(
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


@router.get(
    "/portal/bhuvan/lulc-aoi",
    summary="Get 1:50,000 ISRO Bhuvan LULC AOI Classification Data",
    tags=["Scenario Control & Multi-Portal GeoAI Engine"],
)
async def get_bhuvan_lulc_aoi(region: Optional[str] = None, geom: Optional[str] = None) -> Dict[str, Any]:
    """
    Returns live verified 1:50,000 Level-II LULC classification areas (sq km) for catchment AOI polygons.
    """
    return bhuvan_service.get_lulc_aoi(region_id=region, geom_wkt=geom)

