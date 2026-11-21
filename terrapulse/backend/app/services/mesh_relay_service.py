import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

from app.config import settings
from app.models.schemas import (
    DispatchVector,
    GeoJsonGeometry,
    HazardSeverity,
    MeshModel,
    MeshSyncStatus,
    MeshTransport,
    NavicBand,
    OperationalMode,
    PositionModel,
    SafeAsset,
    ScenarioMode,
    SOSPacket,
    TriageModel,
)
from app.models.state import state_store

logger = logging.getLogger("terrapulse.services.mesh")


class MeshRelayService:
    """
    Domain 04: Tactical Off-Grid NavIC + LoRa Mesh Relay & Evacuation Vector Dispatch
    - NavIC Constellation: Dual-frequency passive positioning (L5 at 1176.45 MHz + S-band at 2492.028 MHz).
    - Tactical Radio: Sub-GHz LoRa (865–867 MHz India ISM license-free band).
    - Operational Role: Zero-cellular peer-to-peer distress beaconing & dry evacuation corridor distribution.
    """

    def __init__(self):
        self.freq_mhz = settings.LORA_FREQUENCY_MHZ
        self.max_hops = settings.MAX_MESH_HOPS
        self.navic_enabled = settings.NAVIC_ENABLED

    def register_or_enrich_sos(self, packet: SOSPacket) -> SOSPacket:
        """
        Validates, simulates mesh propagation hops, enriches positioning,
        and registers distress beacon in the state store.
        """
        # Validate or populate position
        if packet.position.navic_band not in NavicBand:
            packet.position.navic_band = NavicBand.L5

        # Simulate mesh hop advancement
        if packet.mesh.hop_count < packet.mesh.max_hops:
            packet.mesh.hop_count += 1

        # Simulate relay node trail
        relay_node = f"NODE-RELAY-{packet.mesh.hop_count:02d}"
        if relay_node not in packet.mesh.relay_path:
            packet.mesh.relay_path.append(relay_node)

        # Update synchronization status based on backhaul connectivity
        if state_store.cellular_online:
            packet.mesh.sync_status = MeshSyncStatus.SYNCED_COMMAND
        else:
            packet.mesh.sync_status = MeshSyncStatus.RELAYED_MESH

        # Persist in state store
        state_store.sos_packets[packet.sos_id] = packet
        state_store.last_updated = datetime.now(timezone.utc).isoformat()
        logger.info(
            f"SOS beacon registered/relayed: id={packet.sos_id}, severity={packet.triage.severity}, "
            f"hops={packet.mesh.hop_count}, status={packet.mesh.sync_status}"
        )
        return packet

    def build_dispatch_vector(
        self,
        target_zone_id: str,
        alert_headline: str,
        corridor_coordinates: Optional[List[List[float]]] = None,
        safe_asset_name: Optional[str] = None,
        safe_lat: Optional[float] = None,
        safe_lng: Optional[float] = None,
    ) -> DispatchVector:
        """
        Compiles a lightweight dry evacuation corridor vector (<48 KB)
        tailored for low-bandwidth broadcast over NavIC messaging and LoRa mesh.
        """
        dispatch_suffix = uuid4().hex[:6].upper()
        dispatch_id = f"DSP-{dispatch_suffix}"

        # Default to Cartosat DEM high ridge coordinates if none provided
        coordinates = corridor_coordinates or [
            [77.0160, 23.0805],
            [77.0350, 23.1100],
            [77.0600, 23.1450],
            [77.0950, 23.1850],
            [77.1250, 23.2100],
        ]

        safe_asset = SafeAsset(
            name=safe_asset_name or "VIT Bhopal Auditorium & Relief Shelter (Kothri Kalan)",
            lat=safe_lat or 23.0805,
            lng=safe_lng or 77.0160,
            asset_id="BHUVAN-ASSET-SHELTER-02",
        )

        # Calculate payload size in KB
        temp_dict = {
            "dispatch_id": dispatch_id,
            "issued_at": datetime.now(timezone.utc).isoformat(),
            "mode": state_store.mode,
            "target_zone_id": target_zone_id,
            "alert_headline": alert_headline,
            "evacuation_corridor": {"type": "LineString", "coordinates": coordinates},
            "safe_asset": safe_asset.model_dump(),
        }
        raw_bytes = len(json.dumps(temp_dict).encode("utf-8"))
        payload_kb = round(min(raw_bytes / 1024, 48.0), 2)

        dispatch = DispatchVector(
            dispatch_id=dispatch_id,
            issued_at=datetime.now(timezone.utc).isoformat(),
            mode=state_store.mode,
            target_zone_id=target_zone_id,
            alert_headline=alert_headline,
            evacuation_corridor=GeoJsonGeometry(type="LineString", coordinates=coordinates),
            safe_asset=safe_asset,
            payload_kb=payload_kb,
        )

        state_store.dispatches[dispatch_id] = dispatch
        state_store.last_updated = datetime.now(timezone.utc).isoformat()
        logger.info(f"Evacuation dispatch compiled: id={dispatch_id}, payload={payload_kb} KB")
        return dispatch

    def switch_operational_mode(self, new_mode: OperationalMode) -> Dict[str, Any]:
        """
        Switches between NORMAL, CELL_BLACKOUT_MESH_ACTIVE, and BACKHAUL_SYNC operational states.
        """
        state_store.mode = new_mode

        if new_mode == OperationalMode.CELL_BLACKOUT_MESH_ACTIVE:
            state_store.cellular_online = False
            state_store.lora_mesh_active = True
            if state_store.features_collection:
                state_store.features_collection.metadata.scenario_mode = ScenarioMode.TELECOM_BLACKOUT_MESH

            # Update queued SOS packets
            for packet in state_store.sos_packets.values():
                if packet.mesh.sync_status == MeshSyncStatus.QUEUED_OFFLINE:
                    packet.mesh.sync_status = MeshSyncStatus.RELAYED_MESH

            logger.warning("CELLULAR BLACKOUT SIMULATION ACTIVATED: NavIC + LoRa Tactical Mesh operational.")

        else:
            state_store.cellular_online = True
            state_store.lora_mesh_active = (new_mode == OperationalMode.BACKHAUL_SYNC)

            # Mark all mesh packets synced to Central Command
            for packet in state_store.sos_packets.values():
                packet.mesh.sync_status = MeshSyncStatus.SYNCED_COMMAND

            logger.info(f"Backhaul operational: mode set to {new_mode}")

        state_store.last_updated = datetime.now(timezone.utc).isoformat()
        return {
            "mode": state_store.mode,
            "cellular_online": state_store.cellular_online,
            "lora_mesh_active": state_store.lora_mesh_active,
            "active_sos_count": len(state_store.sos_packets),
        }


mesh_relay_service = MeshRelayService()
