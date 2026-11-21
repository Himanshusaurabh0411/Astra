import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, Field

from app.api.ws_live import ws_manager
from app.models.schemas import (
    DispatchVector,
    HazardSeverity,
    MeshModel,
    MeshSyncStatus,
    MeshTransport,
    NavicBand,
    PositionModel,
    SOSPacket,
    TriageModel,
)
from app.models.state import state_store
from app.services.mesh_relay_service import mesh_relay_service

logger = logging.getLogger("terrapulse.api.sos")
router = APIRouter(prefix="/api", tags=["Tactical NavIC + LoRa Mesh & Field Dispatch"])


class SimpleSOSRequest(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0, description="Latitude")
    lng: float = Field(ge=-180.0, le=180.0, description="Longitude")
    severity: HazardSeverity = Field(default=HazardSeverity.MODERATE)
    headcount: int = Field(default=1, ge=1)
    needs: List[str] = Field(default_factory=lambda: ["EVACUATION"])
    note: Optional[str] = None
    device_id: Optional[str] = None
    navic_band: NavicBand = NavicBand.L5


class DispatchPushRequest(BaseModel):
    target_zone_id: str = Field(description="Target rescue zone identifier (e.g. ZONE-KOTHRI-KALAN-SOUTH)")
    alert_headline: str = Field(description="Urgent instructions for evacuees & responders")
    corridor_coordinates: Optional[List[List[float]]] = Field(
        default=None, description="Optional LineString coordinates of safe dry corridor"
    )
    safe_asset_name: Optional[str] = Field(default=None, description="Destination shelter name")
    safe_lat: Optional[float] = Field(default=None, description="Destination latitude")
    safe_lng: Optional[float] = Field(default=None, description="Destination longitude")


@router.get(
    "/sos",
    summary="List Active NavIC + LoRa Distress Beacons",
    response_model=List[SOSPacket],
    response_model_exclude_none=True,
)
async def list_sos_beacons() -> List[SOSPacket]:
    """Returns all currently registered SOS distress packets across the tactical mesh."""
    return list(state_store.sos_packets.values())


@router.post(
    "/sos",
    summary="Submit or Ingest NavIC/LoRa Distress SOS Beacon(s)",
    response_model=Union[SOSPacket, List[SOSPacket]],
    response_model_exclude_none=True,
)
async def ingest_sos_beacon(payload: Union[SOSPacket, List[SOSPacket], SimpleSOSRequest]) -> Union[SOSPacket, List[SOSPacket]]:
    """
    Ingests distress beacons from off-grid NavIC nodes or simulated LoRa relays:
    - Accepts full SOSPacket contract, batch array of SOSPackets, or simplified field beacon.
    - Simulates mesh hop advancement, validates NavIC coordinates, updates sync status.
    - Broadcasts 'sos_received' event to active WebSocket subscribers.
    """
    try:
        # 1. Single full SOSPacket
        if isinstance(payload, SOSPacket):
            registered = mesh_relay_service.register_or_enrich_sos(payload)
            await ws_manager.broadcast("sos_received", registered.model_dump())
            return registered

        # 2. Batch of full SOSPackets
        elif isinstance(payload, list):
            results = []
            for packet in payload:
                reg = mesh_relay_service.register_or_enrich_sos(packet)
                results.append(reg)
            await ws_manager.broadcast("sos_batch_received", [r.model_dump() for r in results])
            return results

        # 3. Simple field request
        elif isinstance(payload, SimpleSOSRequest):
            sos_id = f"SOS-{uuid4().hex[:8].upper()}"
            packet = SOSPacket(
                sos_id=sos_id,
                device_id=payload.device_id or f"NAVIC-NODE-{uuid4().hex[:4].upper()}",
                timestamp=datetime.now(timezone.utc).isoformat(),
                position=PositionModel(
                    lat=payload.lat,
                    lng=payload.lng,
                    accuracy_m=4.0,
                    navic_band=payload.navic_band,
                ),
                triage=TriageModel(
                    severity=payload.severity,
                    headcount=payload.headcount,
                    needs=payload.needs,
                    note=payload.note,
                ),
                mesh=MeshModel(
                    transport=MeshTransport.LORA_865,
                    hop_count=1,
                    max_hops=7,
                    relay_path=["NODE-KOTHRI-CHOWK-01"],
                    sync_status=MeshSyncStatus.RELAYED_MESH if not state_store.cellular_online else MeshSyncStatus.SYNCED_COMMAND,
                ),
            )
            registered = mesh_relay_service.register_or_enrich_sos(packet)
            await ws_manager.broadcast("sos_received", registered.model_dump())
            return registered

    except Exception as e:
        logger.error(f"Failed to ingest SOS beacon: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid SOS distress packet: {str(e)}",
        )


@router.get(
    "/dispatch",
    summary="List Evacuation Corridor Dispatch Vectors",
    response_model=List[DispatchVector],
    response_model_exclude_none=True,
)
async def list_dispatches() -> List[DispatchVector]:
    """Returns active dry evacuation corridor dispatch pushes."""
    return list(state_store.dispatches.values())


@router.post(
    "/dispatch",
    summary="Push Lightweight Evacuation Vector to Field Nodes",
    response_model=DispatchVector,
    response_model_exclude_none=True,
)
async def create_dispatch_vector(req: DispatchPushRequest) -> DispatchVector:
    """
    Constructs and pushes a compact (<48 KB) evacuation vector corridor
    from Central Command to tactical field rescue units and citizen nodes.
    Broadcasts 'dispatch_pushed' event over WebSocket.
    """
    try:
        dispatch = mesh_relay_service.build_dispatch_vector(
            target_zone_id=req.target_zone_id,
            alert_headline=req.alert_headline,
            corridor_coordinates=req.corridor_coordinates,
            safe_asset_name=req.safe_asset_name,
            safe_lat=req.safe_lat,
            safe_lng=req.safe_lng,
        )

        await ws_manager.broadcast("dispatch_pushed", dispatch.model_dump())
        return dispatch

    except Exception as e:
        logger.error(f"Failed to build evacuation dispatch vector: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to compile evacuation dispatch: {str(e)}",
        )
