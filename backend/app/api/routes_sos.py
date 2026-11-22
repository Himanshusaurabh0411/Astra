from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, ConfigDict, Field, model_validator

from app.api.ws_live import ws_manager
from app.config import settings
from app.models.regions import contains, get_regions
from app.models.schemas import (
    DispatchVector, HazardSeverity, MeshModel, MeshSyncStatus, NavicBand,
    PositionModel, SOSPacket, SOSReceipt, TriageModel,
)
from app.models.state import state_store
from app.services.government_auth import require_officer
from app.services.mesh_relay_service import MAX_ACTIVE_SOS, mesh_relay_service
from app.services.sos_email import cancel_pending, record_receipts

router = APIRouter(prefix="/api", tags=["Rescue & Safe Routes"])
StringNeed = Annotated[str, Field(min_length=1, max_length=32)]
Batch = Annotated[list[SOSPacket], Field(min_length=1, max_length=50)]
Lat = Annotated[float, Field(ge=-90, le=90)]
Lng = Annotated[float, Field(ge=-180, le=180)]


class SimpleSOSRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    lat: Lat
    lng: Lng
    severity: HazardSeverity = HazardSeverity.MODERATE
    headcount: int = Field(default=1, ge=1, le=10_000)
    needs: list[StringNeed] = Field(default_factory=lambda: ["EVACUATION"], max_length=10)
    note: str | None = Field(default=None, max_length=240)
    device_id: str | None = Field(default=None, min_length=1, max_length=64)
    navic_band: NavicBand = NavicBand.L5_S_PASSIVE


class DispatchPushRequest(BaseModel):
    target_zone_id: str | None = Field(default=None, min_length=1, max_length=120)
    alert_headline: str | None = Field(default=None, min_length=1, max_length=240)
    corridor_coordinates: list[tuple[Lng, Lat]] | None = Field(default=None, min_length=2, max_length=1600)
    safe_asset_name: str | None = Field(default=None, max_length=160)
    safe_lat: Lat | None = None
    safe_lng: Lng | None = None
    region: str | None = Field(default=None, max_length=120)
    corridor_id: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def validate_area(self):
        if (self.safe_lat is None) != (self.safe_lng is None):
            raise ValueError("Enter both coordinates for the relief point.")
        if self.safe_lng is not None and not contains(settings.india_bbox, (self.safe_lng, self.safe_lat)):
            raise ValueError("Choose a relief point within the India coverage area.")
        if self.corridor_coordinates and not all(contains(settings.india_bbox, pt) for pt in self.corridor_coordinates):
            raise ValueError("Choose a route within the India coverage area.")
        return self


@router.get("/sos", response_model=list[SOSPacket], response_model_exclude_none=True)
async def list_sos_beacons() -> list[SOSPacket]:
    return [packet.public_view() for packet in state_store.sos_packets.values()]


@router.post("/sos", response_model=SOSReceipt | list[SOSReceipt], response_model_exclude_none=True)
async def ingest_sos_beacon(payload: SOSPacket | Batch | SimpleSOSRequest):
    batch = isinstance(payload, list)
    if isinstance(payload, SimpleSOSRequest):
        payload = SOSPacket(
            sos_id=f"SOS-{uuid4().hex[:12].upper()}",
            device_id=payload.device_id or f"FIELD-{uuid4().hex[:8].upper()}",
            position=PositionModel(lat=payload.lat, lng=payload.lng, navic_band=payload.navic_band),
            triage=TriageModel(
                severity=payload.severity, headcount=payload.headcount, needs=payload.needs, note=payload.note,
            ),
            mesh=MeshModel(),
        )
    packets = payload if batch else [payload]
    if any(not contains(settings.india_bbox, (p.position.lng, p.position.lat)) for p in packets):
        raise HTTPException(422, "Choose a location within the India coverage area.")
    new_ids = {p.sos_id for p in packets} - state_store.sos_packets.keys() - state_store.resolved_sos.keys()
    if len(state_store.sos_packets) + len(new_ids) > MAX_ACTIVE_SOS:
        raise HTTPException(503, "The exercise rescue queue is full. Try syncing again later.")
    saved = [mesh_relay_service.register_or_enrich_sos(packet) for packet in packets]
    notices = record_receipts(saved, new_ids)
    receipts = [SOSReceipt(**packet.public_view().model_dump(), email_notification=notices.get(packet.sos_id))
                for packet in saved]
    for sos_id in dict.fromkeys(packet.sos_id for packet in saved if packet.sos_id in new_ids):
        await ws_manager.broadcast("sos_received", {"sos_id": sos_id})
    return receipts if batch else receipts[0]


@router.post("/sos/{sos_id}/relay", response_model=SOSPacket, response_model_exclude_none=True)
async def relay_sos(sos_id: str) -> SOSPacket:
    packet = state_store.sos_packets.get(sos_id)
    if not packet:
        raise HTTPException(404, "This help request could not be found.")
    if packet.mesh.hop_count < packet.mesh.max_hops:
        packet.mesh.hop_count += 1
        packet.mesh.relay_path.append(f"NODE-RELAY-{packet.mesh.hop_count:02d}")
    if not state_store.cellular_online:
        packet.mesh.sync_status = MeshSyncStatus.RELAYED_MESH
    await ws_manager.broadcast("state_updated", {"reason": "sos_relayed"})
    return packet.public_view()


@router.post("/sos/{sos_id}/resolve", dependencies=[Depends(require_officer)])
async def resolve_sos(sos_id: str) -> dict:
    cancel_pending(sos_id)
    packet = state_store.sos_packets.pop(sos_id, None)
    if packet is None and sos_id not in state_store.resolved_sos:
        raise HTTPException(404, "This help request could not be found.")
    if packet is not None:
        state_store.resolved_sos[sos_id] = packet.public_view()
        state_store.last_updated = datetime.now(timezone.utc).isoformat()
        await ws_manager.broadcast("state_updated", {"reason": "sos_resolved"})
    return {"status": "RESOLVED"}


@router.get("/dispatch", response_model=list[DispatchVector], response_model_exclude_none=True)
async def list_dispatches() -> list[DispatchVector]:
    return list(state_store.dispatches.values())


@router.post("/dispatch", response_model=DispatchVector, response_model_exclude_none=True)
async def create_dispatch_vector(req: DispatchPushRequest) -> DispatchVector:
    args = req.model_dump()
    if req.corridor_coordinates:
        args["corridor_coordinates"] = [list(pt) for pt in req.corridor_coordinates]
    try:
        dispatch = mesh_relay_service.build_dispatch_vector(**args)
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    await ws_manager.broadcast("dispatch_pushed", {
        "dispatch_id": dispatch.dispatch_id,
        "destination": dispatch.safe_asset.name,
    })
    return dispatch
