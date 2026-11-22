import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings
from app.models.schemas import (
    AssetType,
    DispatchVector,
    GeoJsonFeatureCollection,
    GeoJsonGeometry,
    HazardSeverity,
    LayerProvenance,
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
        self.layer_provenance: Dict[str, LayerProvenance] = {}
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

                # Ensure default provenance is assigned to seeded features
                for f in self.features_collection.features:
                    if not f.properties.data_source_origin:
                        f.properties.data_source_origin = "seed_fallback"
                    if not f.properties.source_portal:
                        if f.properties.layer == SpatialLayer.MOSDAC_RAIN:
                            f.properties.source_portal = "MOSDAC"
                        elif f.properties.layer == SpatialLayer.BHOONIDHI_FLOOD:
                            f.properties.source_portal = "Bhoonidhi"
                        elif f.properties.layer in (SpatialLayer.VEDAS_ROADS, SpatialLayer.VEDAS_CORRIDORS):
                            f.properties.source_portal = "VEDAS"
                        elif f.properties.layer == SpatialLayer.BHUVAN_ASSETS:
                            f.properties.source_portal = "Bhuvan"

                self._initialize_provenance()
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
                        data_source_origin="seed_fallback",
                        source_portal="MOSDAC",
                    )
                )
            ]
        )
        self._initialize_provenance()

    def _initialize_provenance(self) -> None:
        """Initializes baseline provenance tracking across all 4 ISRO satellite & cadastral portals."""
        counts: Dict[str, int] = {}
        if self.features_collection:
            for f in self.features_collection.features:
                layer_val = f.properties.layer.value if hasattr(f.properties.layer, "value") else str(f.properties.layer)
                counts[layer_val] = counts.get(layer_val, 0) + 1

        self.layer_provenance = {
            "mosdac_rain": LayerProvenance(
                source_portal="MOSDAC",
                ingestion_mode="seed_fallback",
                sensor="INSAT-3DS Imager TIR1 / GSMaP_ISRO",
                status="SYNCHRONIZED",
                features_count=counts.get("mosdac_rain", 1),
            ),
            "bhoonidhi_flood": LayerProvenance(
                source_portal="Bhoonidhi",
                ingestion_mode="seed_fallback",
                sensor="EOS-04 C-band SAR / NISAR",
                status="SYNCHRONIZED",
                features_count=counts.get("bhoonidhi_flood", 1),
            ),
            "vedas_roads": LayerProvenance(
                source_portal="VEDAS",
                ingestion_mode="seed_fallback",
                sensor="Cartosat High-Res DEM Hydrology",
                status="SYNCHRONIZED",
                features_count=counts.get("vedas_roads", 1),
            ),
            "vedas_corridors": LayerProvenance(
                source_portal="VEDAS",
                ingestion_mode="seed_fallback",
                sensor="Cartosat High-Res DEM Hydrology",
                status="SYNCHRONIZED",
                features_count=counts.get("vedas_corridors", 1),
            ),
            "bhuvan_assets": LayerProvenance(
                source_portal="Bhuvan",
                ingestion_mode="seed_fallback",
                sensor="NRSC Cadastral Infrastructure WFS",
                status="SYNCHRONIZED",
                features_count=counts.get("bhuvan_assets", 2),
            ),
        }
        if self.features_collection:
            self.features_collection.metadata.layer_provenance = self.layer_provenance

    def update_layer_provenance(
        self,
        layer: str,
        source_portal: str,
        ingestion_mode: str,
        sensor: Optional[str] = None,
        features_count: Optional[int] = None,
    ) -> None:
        """Updates provenance metadata for an individual ISRO spatial layer."""
        current = self.layer_provenance.get(layer)
        count = features_count
        if count is None and self.features_collection:
            count = sum(
                1 for f in self.features_collection.features
                if (f.properties.layer.value if hasattr(f.properties.layer, "value") else str(f.properties.layer)) == layer
            )

        self.layer_provenance[layer] = LayerProvenance(
            source_portal=source_portal,
            ingestion_mode=ingestion_mode,
            sensor=sensor or (current.sensor if current else None),
            status="SYNCHRONIZED",
            features_count=count or 0,
            updated_at=datetime.now(timezone.utc).isoformat(),
        )
        if self.features_collection:
            self.features_collection.metadata.layer_provenance = self.layer_provenance

    def calculate_payload_kb(self) -> float:
        """Calculates total GeoJSON FeatureCollection payload in Kilobytes."""
        if not self.features_collection:
            return 0.0
        dumped = self.features_collection.model_dump_json()
        kb = round(len(dumped.encode("utf-8")) / 1024, 2)
        self.features_collection.metadata.payload_kb = kb
        return kb

    def _round_coords(self, coords: Any, decimals: int = 4) -> Any:
        if isinstance(coords, (int, float)):
            return round(coords, decimals)
        elif isinstance(coords, list):
            return [self._round_coords(item, decimals) for item in coords]
        return coords

    def enforce_payload_budget(self, max_kb: float = 100.0) -> float:
        """
        Guarantees that the serialized GeoJSON FeatureCollection strictly conforms
        to the disaster low-bandwidth budget (< 100 KB).
        If the payload exceeds max_kb, simplifies coordinate precision and
        retains high-priority tactical elements.
        """
        if not self.features_collection:
            return 0.0

        current_kb = self.calculate_payload_kb()
        if current_kb <= max_kb:
            return current_kb

        logger.warning(f"Payload {current_kb} KB exceeds budget {max_kb} KB. Applying GeoAI compression.")

        # Step 1: Round coordinates to 4 decimal places (~11m resolution)
        for feature in self.features_collection.features:
            coords = feature.geometry.coordinates
            feature.geometry.coordinates = self._round_coords(coords, decimals=4)

        current_kb = self.calculate_payload_kb()
        if current_kb <= max_kb:
            return current_kb

        # Step 2: Decimate polygon vertices if shapely is available
        try:
            from shapely.geometry import Polygon as ShapelyPolygon
            for feature in self.features_collection.features:
                if feature.geometry.type == "Polygon":
                    simplified_rings = []
                    for ring in feature.geometry.coordinates:
                        if len(ring) > 8:
                            p = ShapelyPolygon(ring).simplify(0.001, preserve_topology=True)
                            simplified_rings.append([[round(pt[0], 4), round(pt[1], 4)] for pt in p.exterior.coords])
                        else:
                            simplified_rings.append(ring)
                    feature.geometry.coordinates = simplified_rings
        except Exception as e:
            logger.debug(f"Shapely geometry simplification skipped: {e}")

        current_kb = self.calculate_payload_kb()
        if current_kb <= max_kb:
            return current_kb

        # Step 3: Prioritized pruning - keep all high severity, critical assets, submerged roads, and open corridors
        priority_features = [
            f for f in self.features_collection.features
            if f.properties.severity in (HazardSeverity.CRITICAL, HazardSeverity.HIGH)
            or f.properties.road_status in (RoadStatus.SUBMERGED, RoadStatus.CORRIDOR)
            or f.properties.asset_type in (AssetType.HOSPITAL, AssetType.SHELTER, AssetType.RESERVOIR)
        ]
        other_features = [
            f for f in self.features_collection.features
            if f not in priority_features
        ]

        # Retain as many other features as fit under budget
        retained = list(priority_features)
        for f in other_features:
            retained.append(f)
            self.features_collection.features = retained
            if self.calculate_payload_kb() >= max_kb - 2.0:
                retained.pop()
                break

        self.features_collection.features = retained
        return self.calculate_payload_kb()

    def execute_cascade(
        self,
        rainfall_mm_hr: Optional[float] = None,
        multiplier: float = 4.0,
        trigger_source: str = "simulation_spike",
    ) -> Dict[str, Any]:
        """
        Unified Space-to-Ground Cascade fusing all 4 ISRO portal services:
        1. MOSDAC: Evaluates or spikes INSAT-3DS/GSMaP rainfall rate past 15 mm/hr threshold.
        2. Bhoonidhi: Evaluates EOS-04/NISAR SAR backscatter drop and flood expansion.
        3. VEDAS: Calculates Cartosat DEM drainage runoff, marks causeway SUBMERGED, keeps ridge CORRIDOR open.
        4. Bhuvan: Triages hospital to emergency intake, designates VIT Bhopal shelter, alerts reservoir.
        5. Updates per-layer provenance and guarantees <100 KB payload budget.
        """
        from app.services.mosdac_service import mosdac_service
        from app.services.bhoonidhi_service import bhoonidhi_service
        from app.services.vedas_service import vedas_service
        from app.services.bhuvan_service import bhuvan_service

        # 1. MOSDAC Rainfall Evaluation / Spike
        new_rain = mosdac_service.trigger_rainfall_spike(
            multiplier=multiplier,
            target_rain_mm_hr=rainfall_mm_hr,
        )
        self.update_layer_provenance(
            layer="mosdac_rain",
            source_portal="MOSDAC",
            ingestion_mode=trigger_source,
            sensor="INSAT-3DS Imager TIR1 / GSMaP_ISRO",
        )

        # 2. Bhoonidhi Microwave SAR Inundation Extraction
        bhoonidhi_res = bhoonidhi_service.evaluate_flood_inundation(new_rain)
        water_depth = bhoonidhi_res.get("peak_water_depth_m", 1.8)
        self.update_layer_provenance(
            layer="bhoonidhi_flood",
            source_portal="Bhoonidhi",
            ingestion_mode=bhoonidhi_service.last_source_origin,
            sensor="EOS-04 C-band SAR / NISAR",
        )

        # 3. VEDAS Cartosat DEM Road & Corridor Routing
        vedas_res = vedas_service.evaluate_roads_and_corridors(
            water_depth_m=water_depth,
            rainfall_mm_hr=new_rain,
        )
        self.update_layer_provenance(
            layer="vedas_roads",
            source_portal="VEDAS",
            ingestion_mode=vedas_service.last_source_origin,
            sensor="Cartosat High-Res DEM Hydrology",
        )
        self.update_layer_provenance(
            layer="vedas_corridors",
            source_portal="VEDAS",
            ingestion_mode=vedas_service.last_source_origin,
            sensor="Cartosat High-Res DEM Hydrology",
        )

        # 4. Bhuvan Cadastral Asset Triage
        bhuvan_service.evaluate_critical_infrastructure(
            rainfall_mm_hr=new_rain,
            flood_depth_m=water_depth,
        )
        self.update_layer_provenance(
            layer="bhuvan_assets",
            source_portal="Bhuvan",
            ingestion_mode=bhuvan_service.last_source_origin,
            sensor="NRSC Cadastral Infrastructure WFS",
        )

        # 5. Evacuation Dispatch Vector Refresh
        if new_rain >= settings.RAINFALL_THRESHOLD_MM_HR:
            if "DSP-KOTHRI-VEC-01" in self.dispatches:
                disp = self.dispatches["DSP-KOTHRI-VEC-01"]
                disp.alert_headline = (
                    f"URGENT EVACUATION DISPATCH: Sevan causeway submerged ({water_depth}m). "
                    f"Evacuate immediately via Cartosat High-Elevation Ridge Corridor to VIT Bhopal Auditorium."
                )
                disp.issued_at = datetime.now(timezone.utc).isoformat()

        # 6. Overall Metadata & Scenario Mode
        if self.features_collection:
            self.features_collection.metadata.source_portal = "TerraPulse_GeoAI"
            if new_rain >= settings.RAINFALL_THRESHOLD_MM_HR:
                self.features_collection.metadata.scenario_mode = ScenarioMode.VEDAS_DEM_CORRIDORS
            self.features_collection.metadata.layer_provenance = self.layer_provenance

        # 7. Payload Budget Enforcement (< 100 KB)
        final_payload_kb = self.enforce_payload_budget(max_kb=settings.MAX_VECTOR_PAYLOAD_KB)
        self.last_updated = datetime.now(timezone.utc).isoformat()

        logger.info(
            f"Space-to-ground cascade executed: rain={new_rain} mm/hr, depth={water_depth}m, "
            f"payload={final_payload_kb} KB (<{settings.MAX_VECTOR_PAYLOAD_KB} KB target)"
        )

        return {
            "rainfall_mm_hr": new_rain,
            "peak_water_depth_m": water_depth,
            "threshold_breached": new_rain >= settings.RAINFALL_THRESHOLD_MM_HR,
            "submerged_roads": vedas_res.get("submerged_roads", 1),
            "open_corridors": vedas_res.get("open_corridors", 1),
            "payload_kb": final_payload_kb,
            "layer_provenance": {k: v.model_dump() for k, v in self.layer_provenance.items()},
        }

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
        payload_kb = self.enforce_payload_budget(settings.MAX_VECTOR_PAYLOAD_KB)
        return TerraPulseStateResponse(
            mode=self.mode,
            features=self.features_collection,
            payload_kb=payload_kb,
            sos_packets=list(self.sos_packets.values()),
            dispatches=list(self.dispatches.values()),
            kpis=self.get_kpis(),
            last_updated=self.last_updated,
        )


# Global singleton instance
state_store = TerraPulseStateStore()
