import logging
from datetime import datetime, timezone
from uuid import uuid4

from app.config import settings
from app.models.regions import canonical_region
from app.models.schemas import (
    AssetType, DispatchVector, GeoJsonGeometry, MeshSyncStatus, OperationalMode,
    RoadStatus, SafeAsset, SOSPacket,
)
from app.models.state import state_store
from app.models.vectors import measure_payload, rounded_coords

logger = logging.getLogger("terrapulse.services.mesh")
MAX_ACTIVE_SOS = 500
MAX_DISPATCH_HISTORY = 50


class MeshRelayService:
    """Simulate radio hops and store acknowledged packets for the current exercise."""

    def register_or_enrich_sos(self, packet: SOSPacket) -> SOSPacket:
        existing = state_store.sos_packets.get(packet.sos_id)
        if existing:
            return existing

        packet.mesh.max_hops = min(packet.mesh.max_hops, settings.MAX_MESH_HOPS)
        next_hop = min(max(2, packet.mesh.hop_count + 1), packet.mesh.max_hops)
        relays = packet.mesh.relay_path[:min(packet.mesh.hop_count, next_hop)]
        relays.extend(f"NODE-RELAY-{hop:02d}" for hop in range(len(relays) + 1, next_hop + 1))
        packet.mesh.hop_count = next_hop
        packet.mesh.relay_path = relays
        packet.mesh.sync_status = (
            MeshSyncStatus.SYNCED_COMMAND if state_store.cellular_online else MeshSyncStatus.RELAYED_MESH
        )
        state_store.sos_packets[packet.sos_id] = packet
        state_store.last_updated = datetime.now(timezone.utc).isoformat()
        return packet

    def build_dispatch_vector(
        self,
        target_zone_id: str | None = None,
        alert_headline: str | None = None,
        corridor_coordinates: list[list[float]] | None = None,
        safe_asset_name: str | None = None,
        safe_lat: float | None = None,
        safe_lng: float | None = None,
        region: str | None = None,
        corridor_id: str | None = None,
    ) -> DispatchVector:
        region_id = canonical_region(region)
        if region_id == "all-india":
            region_id = "central-india"
        destination_id = None

        if corridor_coordinates is None:
            features = [f for f in state_store.all_features if f.properties.region_id == region_id]
            routes = [
                f for f in features if f.properties.road_status == RoadStatus.CORRIDOR
                and f.geometry.type == "LineString" and f.geometry.coordinates
            ]
            route = next((f for f in routes if not corridor_id or f.id == corridor_id), None)
            shelters = [f for f in features if f.properties.asset_type == AssetType.SHELTER and f.geometry.type == "Point"]
            if route is None or not shelters:
                raise ValueError("This area has no route and shelter pair to share.")
            corridor_coordinates = route.geometry.coordinates
            first, last = corridor_coordinates[0], corridor_coordinates[-1]

            def distance(asset, point):
                x, y = asset.geometry.coordinates[:2]
                return (x - point[0]) ** 2 + (y - point[1]) ** 2

            shelter = min(shelters, key=lambda asset: min(distance(asset, first), distance(asset, last)))
            if min(distance(shelter, first), distance(shelter, last)) > 0.02 ** 2:
                raise ValueError("This route has no mapped shelter at either end.")
            if distance(shelter, first) < distance(shelter, last):
                corridor_coordinates = list(reversed(corridor_coordinates))
            destination_lng, destination_lat = shelter.geometry.coordinates[:2]
            safe_lat, safe_lng = destination_lat, destination_lng
            safe_asset_name = shelter.properties.title
            destination_id = shelter.id
            alert_headline = alert_headline or f"Follow {route.properties.title} towards {safe_asset_name}."

        if safe_lat is None or safe_lng is None:
            safe_lng, safe_lat = corridor_coordinates[-1][:2]
        dispatch = DispatchVector(
            dispatch_id=f"DSP-{uuid4().hex[:12].upper()}",
            issued_at=datetime.now(timezone.utc).isoformat(),
            mode=state_store.mode,
            target_zone_id=target_zone_id or region_id,
            alert_headline=alert_headline or "Follow the marked exercise route to the relief point.",
            evacuation_corridor=GeoJsonGeometry(type="LineString", coordinates=rounded_coords(corridor_coordinates)),
            safe_asset=SafeAsset(
                name=safe_asset_name or "Relief point",
                lat=safe_lat,
                lng=safe_lng,
                asset_id=destination_id,
            ),
            payload_kb=0.0,
        )
        size = measure_payload(dispatch, dispatch)
        if size >= min(48.0, settings.MAX_VECTOR_PAYLOAD_KB) * 1000:
            raise ValueError("This route is too large to share. Choose a shorter route.")
        state_store.dispatches[dispatch.dispatch_id] = dispatch
        while len(state_store.dispatches) > MAX_DISPATCH_HISTORY:
            state_store.dispatches.pop(next(iter(state_store.dispatches)))
        state_store.last_updated = dispatch.issued_at
        return dispatch

    def switch_operational_mode(self, mode: OperationalMode) -> None:
        state_store.mode = mode
        state_store.cellular_online = mode != OperationalMode.CELL_BLACKOUT_MESH_ACTIVE
        state_store.lora_mesh_active = mode != OperationalMode.NORMAL

        for packet in state_store.sos_packets.values():
            if state_store.cellular_online:
                packet.mesh.sync_status = MeshSyncStatus.SYNCED_COMMAND
            elif packet.mesh.sync_status == MeshSyncStatus.QUEUED_OFFLINE:
                packet.mesh.sync_status = MeshSyncStatus.RELAYED_MESH

        state_store.last_updated = datetime.now(timezone.utc).isoformat()


mesh_relay_service = MeshRelayService()
