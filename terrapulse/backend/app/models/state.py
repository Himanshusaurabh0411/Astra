import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

from app.config import settings
from app.models.schemas import (
    AssetType,
    DispatchVector,
    GeoJsonFeatureCollection,
    GeoJsonGeometry,
    HazardSeverity,
    MeshModel,
    MeshSyncStatus,
    MeshTransport,
    NavicBand,
    OperationalMode,
    PositionModel,
    RoadStatus,
    SafeAsset,
    ScenarioMode,
    SOSPacket,
    SpatialLayer,
    StateSummaryKPIs,
    TerraPulseStateResponse,
    TriageModel,
)

logger = logging.getLogger("terrapulse.state")


class TerraPulseStateStore:
    """
    Central in-memory state store for TerraPulse.
    Maintains loaded GeoAI layers, offline distress beacons, and evacuation dispatches.
    Computes real-time KPIs and payload sizes in KB.
    """

    def __init__(self, seed_path: Optional[Path] = None):
        self.seed_path = seed_path or settings.resolve_seed_data_path()
        self.mode: OperationalMode = OperationalMode.NORMAL
        self.cellular_online: bool = True
        self.navic_locked: bool = True
        self.lora_mesh_active: bool = False
        self.features_collection: Optional[GeoJsonFeatureCollection] = None
        self.sos_packets: Dict[str, SOSPacket] = {}
        self.dispatches: Dict[str, DispatchVector] = {}
        self.last_updated: str = datetime.now(timezone.utc).isoformat()

        # Load initial baseline state
        self.reset_to_baseline()

    def reset_to_baseline(self) -> None:
        """
        Reloads the baseline GeoJSON catchment data and seeds initial distress
        packets and evacuation dispatches for Kothri Kalan / Sehore / Bhopal basin.
        """
        logger.info(f"Resetting TerraPulseStateStore to baseline from: {self.seed_path}")
        self.mode = OperationalMode.NORMAL
        self.cellular_online = True
        self.navic_locked = True
        self.lora_mesh_active = False
        self.sos_packets.clear()
        self.dispatches.clear()

        # 1. Load GeoJSON Seed Data
        if self.seed_path.exists() and self.seed_path.is_file():
            try:
                with open(self.seed_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                self.features_collection = GeoJsonFeatureCollection.model_validate(raw_data)
                # Compute payload size in KB
                payload_bytes = len(json.dumps(raw_data).encode("utf-8"))
                self.features_collection.metadata.payload_kb = round(payload_bytes / 1024, 2)
                logger.info(
                    f"Successfully loaded {len(self.features_collection.features)} features "
                    f"({self.features_collection.metadata.payload_kb} KB) from seed"
                )
            except Exception as e:
                logger.error(f"Failed to parse seed GeoJSON from {self.seed_path}: {e}", exc_info=True)
                self._fallback_seed()
        else:
            logger.warning(f"Seed file not found at {self.seed_path}, creating fallback baseline")
            self._fallback_seed()

        # 2. Seed Realistic Initial SOS Distress Packets (Kothri Kalan Basin)
        # Beacon 1: Near Sevan River causeway (Critical triage)
        sos_1 = SOSPacket(
            sos_id="SOS-20261121-0042",
            device_id="NAVIC-NODE-409B",
            timestamp=datetime.now(timezone.utc).isoformat(),
            position=PositionModel(
                lat=23.0910,
                lng=77.0580,
                accuracy_m=3.5,
                navic_band=NavicBand.L5,
            ),
            triage=TriageModel(
                severity=HazardSeverity.CRITICAL,
                headcount=4,
                needs=["EVACUATION", "MEDICAL"],
                note="Water rising near Sevan causeway; elderly resident requiring oxygen support.",
            ),
            mesh=MeshModel(
                transport=MeshTransport.LORA_865,
                hop_count=2,
                max_hops=7,
                relay_path=["NODE-KOTHRI-CHOWK-01", "NODE-HIGHWAY-RELAY-04"],
                sync_status=MeshSyncStatus.RELAYED_MESH,
            ),
        )
        self.sos_packets[sos_1.sos_id] = sos_1

        # Beacon 2: Kothri Kalan West low agricultural hamlet (Moderate triage)
        sos_2 = SOSPacket(
            sos_id="SOS-20261121-0089",
            device_id="NAVIC-NODE-112A",
            timestamp=datetime.now(timezone.utc).isoformat(),
            position=PositionModel(
                lat=23.0840,
                lng=77.0320,
                accuracy_m=4.2,
                navic_band=NavicBand.L5,
            ),
            triage=TriageModel(
                severity=HazardSeverity.MODERATE,
                headcount=7,
                needs=["WATER", "FOOD"],
                note="Isolated agricultural dwelling; road muddy and cut off, shelter building intact.",
            ),
            mesh=MeshModel(
                transport=MeshTransport.LORA_865,
                hop_count=1,
                max_hops=7,
                relay_path=["NODE-KOTHRI-WEST-02"],
                sync_status=MeshSyncStatus.QUEUED_OFFLINE,
            ),
        )
        self.sos_packets[sos_2.sos_id] = sos_2

        # 3. Seed Realistic Evacuation Dispatch Vector
        disp_1 = DispatchVector(
            dispatch_id="DSP-KOTHRI-VEC-01",
            issued_at=datetime.now(timezone.utc).isoformat(),
            mode=OperationalMode.NORMAL,
            target_zone_id="ZONE-KOTHRI-KALAN-SOUTH",
            alert_headline="Evacuation Corridor Primed: High-Elevation Ridge Route to VIT Bhopal Auditorium.",
            evacuation_corridor=GeoJsonGeometry(
                type="LineString",
                coordinates=[
                    [77.0160, 23.0805],
                    [77.0350, 23.1100],
                    [77.0600, 23.1450],
                    [77.0950, 23.1850],
                    [77.1250, 23.2100],
                ],
            ),
            safe_asset=SafeAsset(
                name="VIT Bhopal Auditorium & Relief Shelter (Kothri Kalan)",
                lat=23.0805,
                lng=77.0160,
                asset_id="BHUVAN-ASSET-SHELTER-02",
            ),
            payload_kb=2.8,
        )
        self.dispatches[disp_1.dispatch_id] = disp_1

        self.last_updated = datetime.now(timezone.utc).isoformat()

    def _fallback_seed(self) -> None:
        """Constructs an in-memory baseline if seed file cannot be loaded."""
        from app.models.schemas import (
            GeoJsonFeature,
            GeoJsonFeatureProperties,
            GeoJsonMetadata,
        )
        self.features_collection = GeoJsonFeatureCollection(
            metadata=GeoJsonMetadata(
                source_portal="TerraPulse_GeoAI",
                payload_kb=1.5,
                scenario_mode=ScenarioMode.BASELINE,
            ),
            features=[
                GeoJsonFeature(
                    id="MOSDAC-RAIN-FALLBACK",
                    geometry=GeoJsonGeometry(
                        type="Polygon",
                        coordinates=[[[77.01, 23.07], [77.20, 23.07], [77.20, 23.22], [77.01, 23.22], [77.01, 23.07]]]
                    ),
                    properties=GeoJsonFeatureProperties(
                        layer=SpatialLayer.MOSDAC_RAIN,
                        title="MOSDAC Fallback Precipitation Grid",
                        severity=HazardSeverity.LOW,
                        rainfall_mm_hr=4.8,
                        water_depth_m=0.0,
                        recommended_action="Baseline monitoring.",
                    )
                )
            ]
        )

    def calculate_payload_kb(self) -> float:
        """Calculates total GeoJSON FeatureCollection payload in Kilobytes."""
        if not self.features_collection:
            return 0.0
        dumped = self.features_collection.model_dump_json()
        kb = round(len(dumped.encode("utf-8")) / 1024, 2)
        self.features_collection.metadata.payload_kb = kb
        return kb

    def get_kpis(self) -> StateSummaryKPIs:
        """Calculates real-time tactical and geospatial KPIs."""
        features = self.features_collection.features if self.features_collection else []
        submerged_roads = sum(1 for f in features if f.properties.road_status == RoadStatus.SUBMERGED)
        open_corridors = sum(1 for f in features if f.properties.road_status == RoadStatus.CORRIDOR)
        shelters = sum(1 for f in features if f.properties.asset_type == AssetType.SHELTER)
        critical_sos = sum(1 for s in self.sos_packets.values() if s.triage.severity == HazardSeverity.CRITICAL)

        max_rain = max((f.properties.rainfall_mm_hr for f in features), default=0.0)
        max_depth = max((f.properties.water_depth_m for f in features), default=0.0)

        return StateSummaryKPIs(
            total_features=len(features),
            active_sos_count=len(self.sos_packets),
            critical_sos_count=critical_sos,
            submerged_roads_count=submerged_roads,
            open_corridors_count=open_corridors,
            safe_shelters_count=shelters,
            payload_kb=self.calculate_payload_kb(),
            cellular_online=self.cellular_online,
            navic_locked=self.navic_locked,
            lora_mesh_active=self.lora_mesh_active,
            max_rainfall_mm_hr=round(max_rain, 1),
            max_water_depth_m=round(max_depth, 2),
        )

    def get_state_response(self) -> TerraPulseStateResponse:
        """Returns the complete unified state response model."""
        return TerraPulseStateResponse(
            mode=self.mode,
            features=self.features_collection,
            payload_kb=self.calculate_payload_kb(),
            sos_packets=list(self.sos_packets.values()),
            dispatches=list(self.dispatches.values()),
            kpis=self.get_kpis(),
            last_updated=self.last_updated,
        )


# Global singleton instance
state_store = TerraPulseStateStore()
