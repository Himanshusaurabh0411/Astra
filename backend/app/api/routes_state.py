from fastapi import APIRouter, HTTPException, Query

from app.api.ws_live import ws_manager
from app.config import parse_bbox, settings
from app.models.regions import Region, canonical_region, get_regions
from app.models.schemas import TerraPulseStateResponse
from app.models.state import state_store
from app.services.sos_email import cancel_pending

router = APIRouter(tags=["State & Telemetry"])


@router.get("/health")
async def health_check():
    state = state_store.get_state_response()
    return {
        "status": "HEALTHY",
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.APP_ENV,
        "mode": state.mode,
        "portals": state.features.metadata.portal_provenance,
        "tactical_mesh": {
            "lora_frequency_mhz": settings.LORA_FREQUENCY_MHZ,
            "lora_band_mhz": "865–867 MHz",
            "navic_locked": state_store.navic_locked,
            "navic_mode": "L5+S_PASSIVE" if state_store.navic_locked else "DISABLED",
            "lora_mesh_active": state_store.lora_mesh_active,
            "simulation": True,
        },
        "features_loaded": len(state_store.all_features),
        "payload_kb": state.payload_kb,
    }


@router.get("/api/regions", response_model=list[Region])
async def list_regions() -> list[Region]:
    regions = []
    for region in get_regions().values():
        kpis = state_store.get_state_response(region.id).kpis
        regions.append(region.model_copy(update={"risk_summary": {
            "heavy_rain_alerts": kpis.heavy_rain_alerts,
            "blocked_roads": kpis.submerged_roads_count,
            "help_requests": kpis.active_sos_count,
        }}))
    return regions


@router.get("/api/state", response_model=TerraPulseStateResponse, response_model_exclude_none=True)
async def get_state(
    region: str | None = Query(default=None, max_length=120),
    bbox: str | None = Query(default=None, max_length=100),
) -> TerraPulseStateResponse:
    try:
        region_id = canonical_region(region)
    except ValueError as exc:
        raise HTTPException(404, str(exc)) from exc
    try:
        bounds = parse_bbox(bbox) if bbox is not None else None
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    return state_store.get_state_response(region_id, bounds)


@router.post("/api/state/reset", response_model=TerraPulseStateResponse, response_model_exclude_none=True)
async def reset_state() -> TerraPulseStateResponse:
    cancel_pending()
    state_store.reset_to_baseline()
    result = state_store.get_state_response()
    await ws_manager.broadcast("state_updated", {"reason": "reset", "mode": result.mode})
    return result
