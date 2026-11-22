import json
import logging
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.config import settings
from app.models.regions import Bounds, area_km2, contains, geometry_bounds, get_regions, intersects, region_at
from app.models.vectors import compact_collection, size_collection
from app.models.schemas import (
    AssetType,
    DispatchVector,
    GeoJsonFeature,
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
    PortalProvenance,
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

PORTAL_LAYERS = {
    "MOSDAC": (SpatialLayer.MOSDAC_RAIN,),
    "Bhoonidhi": (SpatialLayer.BHOONIDHI_FLOOD,),
    "VEDAS": (SpatialLayer.VEDAS_ROADS, SpatialLayer.VEDAS_CORRIDORS),
    "Bhuvan": (SpatialLayer.BHUVAN_ASSETS,),
}



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
        self.resolved_sos: Dict[str, SOSPacket] = {}
        self.dispatches: Dict[str, DispatchVector] = {}
        self.regional_features: list[GeoJsonFeature] = []
        self.baseline_features: list[GeoJsonFeature] = []
        self.portal_provenance: dict[str, PortalProvenance] = {}
        self.last_updated: str = datetime.now(timezone.utc).isoformat()

        # Load initial baseline state
        self.reset_to_baseline()

    def reset_to_baseline(self) -> None:
        """
        Reloads the baseline GeoJSON catchment data and seeds initial distress
        packets and evacuation dispatches for Kothri Kalan / Sehore / Bhopal basin.
        """
        logger.info(f"Resetting TerraPulseStateStore to baseline from: {self.seed_path}")
        self.mode = OperationalMode(settings.DEFAULT_SCENARIO_MODE)
        self.cellular_online = self.mode != OperationalMode.CELL_BLACKOUT_MESH_ACTIVE
        self.navic_locked = settings.NAVIC_ENABLED
        self.lora_mesh_active = self.mode != OperationalMode.NORMAL
        self.regional_features.clear()
        self.sos_packets.clear()
        self.resolved_sos.clear()
        self.dispatches.clear()

        # 1. Load GeoJSON Seed Data
        if self.seed_path.exists() and self.seed_path.is_file():
            try:
                with open(self.seed_path, "r", encoding="utf-8") as f:
                    raw_data = json.load(f)
                self.features_collection = GeoJsonFeatureCollection.model_validate(raw_data)
                self.features_collection.features = [
                    f for f in self.features_collection.features
                    if intersects(geometry_bounds(f.geometry.coordinates), settings.india_bbox)
                ]
                for feature in self.features_collection.features:
                    props = feature.properties
                    props.source_portal = next(
                        name for name, layers in PORTAL_LAYERS.items() if props.layer in layers
                    )
                    props.data_source_origin = "seed_fallback"
                    if not props.region_id:
                        props.region_id = self._locate_region(feature)
                self._partition_features(self.features_collection.features)
                self._initialize_provenance()
                size_collection(self.features_collection)
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

        self.baseline_features = [f.model_copy(deep=True) for f in self.all_features]
        now = datetime.now(timezone.utc).isoformat()
        self.portal_provenance = {
            name: PortalProvenance(
                source_type="seed_fallback",
                records_ingested=sum(f.properties.layer in layers for f in self.baseline_features),
                last_synced_at=now,
            )
            for name, layers in PORTAL_LAYERS.items()
        }

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
            payload_kb=0.0,
        )
        from app.models.vectors import measure_payload
        measure_payload(disp_1, disp_1)
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
            for f in self.all_features:
                layer_val = f.properties.layer.value if hasattr(f.properties.layer, "value") else str(f.properties.layer)
                counts[layer_val] = counts.get(layer_val, 0) + 1

        self.layer_provenance = {
            "mosdac_rain": LayerProvenance(
                source_portal="MOSDAC",
                ingestion_mode="seed_fallback",
                sensor="INSAT-3DS Imager TIR1 / GSMaP_ISRO",
                status="SYNCHRONIZED",
                features_count=counts.get("mosdac_rain", 0),
            ),
            "bhoonidhi_flood": LayerProvenance(
                source_portal="Bhoonidhi",
                ingestion_mode="seed_fallback",
                sensor="EOS-04 C-band SAR / NISAR",
                status="SYNCHRONIZED",
                features_count=counts.get("bhoonidhi_flood", 0),
            ),
            "vedas_roads": LayerProvenance(
                source_portal="VEDAS",
                ingestion_mode="seed_fallback",
                sensor="Cartosat High-Res DEM Hydrology",
                status="SYNCHRONIZED",
                features_count=counts.get("vedas_roads", 0),
            ),
            "vedas_corridors": LayerProvenance(
                source_portal="VEDAS",
                ingestion_mode="seed_fallback",
                sensor="Cartosat High-Res DEM Hydrology",
                status="SYNCHRONIZED",
                features_count=counts.get("vedas_corridors", 0),
            ),
            "bhuvan_assets": LayerProvenance(
                source_portal="Bhuvan",
                ingestion_mode="seed_fallback",
                sensor="NRSC Cadastral Infrastructure WFS",
                status="SYNCHRONIZED",
                features_count=counts.get("bhuvan_assets", 0),
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

    @property
    def all_features(self) -> list[GeoJsonFeature]:
        return [*self.features_collection.features, *self.regional_features]

    @staticmethod
    def _locate_region(feature: GeoJsonFeature) -> str | None:
        bounds = geometry_bounds(feature.geometry.coordinates)
        if bounds:
            west, south, east, north = bounds
            return region_at(((west + east) / 2, (south + north) / 2))
        return None

    def _partition_features(self, features: list[GeoJsonFeature]) -> None:
        # Keep the original Sehore cascade on its named reference features.
        central, regional = [], []
        for feature in features:
            props = feature.properties
            props.region_id = props.region_id or self._locate_region(feature)
            if props.region_id == "central-india" and not (feature.id or "").startswith("TP-"):
                central.append(feature)
            else:
                regional.append(feature)
        self.features_collection.features = central
        self.regional_features = regional

    def apply_portal_sync(self, layers: dict) -> None:
        """Replace measurements together after all four readers finish."""
        now = datetime.now(timezone.utc).isoformat()
        next_features = []
        for portal, (features, source) in layers.items():
            for feature in features:
                feature.properties.region_id = feature.properties.region_id or self._locate_region(feature)
            covered = {(f.properties.layer, f.properties.region_id) for f in features}
            incoming_ids = {f.id for f in features if f.id}
            seeds = [
                f.model_copy(deep=True) for f in self.baseline_features
                if f.properties.layer in PORTAL_LAYERS[portal]
                and f.id not in incoming_ids
                and (source != "live_portal" or (f.properties.layer, f.properties.region_id) not in covered)
            ]
            next_features.extend(seeds)
            next_features.extend(features)
            self.portal_provenance[portal] = PortalProvenance(
                source_type=source,
                records_ingested=len(features) if source != "seed_fallback" else len(seeds),
                last_synced_at=now,
            )
            for layer in PORTAL_LAYERS[portal]:
                self.update_layer_provenance(
                    layer.value, portal, source,
                    features_count=sum(f.properties.layer == layer for f in [*seeds, *features]),
                )
        self._partition_features(next_features)
        self.features_collection.metadata.scenario_mode = ScenarioMode.BASELINE
        self.last_updated = now

    def calculate_payload_kb(self) -> float:
        return size_collection(self.features_collection)

    def enforce_payload_budget(self, max_kb: float = 100.0) -> float:
        view = compact_collection(self.features_collection, max_kb)
        self.features_collection.metadata.payload_kb = view.metadata.payload_kb
        return view.metadata.payload_kb

    def simulate_region(self, region_id: str, rainfall: float | None, multiplier: float) -> None:
        selected = [f for f in self.all_features if f.properties.region_id == region_id]
        rates = [f.properties.rainfall_mm_hr for f in selected if f.properties.layer == SpatialLayer.MOSDAC_RAIN]
        rate = rainfall if rainfall is not None else min(250, round(max(rates, default=4.8) * multiplier, 1))
        heavy = rate > settings.RAINFALL_THRESHOLD_MM_HR
        depth = round(min(3.2, 0.45 + rate / 34), 2) if heavy else 0
        timestamp = datetime.now(timezone.utc).isoformat()

        for feature in selected:
            props = feature.properties
            props.data_source_origin = "simulation_spike"
            props.observed_at = timestamp
            if props.layer == SpatialLayer.MOSDAC_RAIN:
                props.rainfall_mm_hr = rate
                props.severity = HazardSeverity.HIGH if heavy else HazardSeverity.LOW
                props.hazard_type = "FLASH_FLOOD_CLOUD_BURST" if heavy else "MONSOON_RAIN"
                props.recommended_action = "Avoid low-lying roads and check local alerts." if heavy else "Check local weather before travelling."
            elif props.layer == SpatialLayer.BHOONIDHI_FLOOD:
                props.water_depth_m = depth
                props.area_km2 = None if heavy else 0
                props.hazard_type = "RIVERINE_INUNDATION" if heavy else "NONE"
                props.severity = HazardSeverity.HIGH if heavy else HazardSeverity.LOW
                props.recommended_action = "Keep clear of standing water and use higher ground." if heavy else "Check local river conditions."
            elif props.layer == SpatialLayer.VEDAS_ROADS and feature.geometry.type == "LineString":
                submerged = heavy and depth > (props.clearance_m or 0.35)
                props.road_status = RoadStatus.SUBMERGED if submerged else RoadStatus.OPEN
                props.water_depth_m = depth if submerged else 0
                props.severity = HazardSeverity.CRITICAL if submerged else HazardSeverity.LOW
                props.recommended_action = "Avoid this crossing and follow the marked high-ground route." if submerged else "Check the road before travelling."
            elif props.asset_type == AssetType.SHELTER:
                props.recommended_action = "Check with local responders before heading to this relief point."

        self.features_collection.metadata.scenario_mode = ScenarioMode.VEDAS_DEM_CORRIDORS if heavy else ScenarioMode.BASELINE
        self.last_updated = timestamp

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

    def get_kpis(
        self,
        features: list[GeoJsonFeature] | None = None,
        sos_packets: list[SOSPacket] | None = None,
        payload_kb: float | None = None,
        total_features: int | None = None,
    ) -> StateSummaryKPIs:
        features = self.all_features if features is None else features
        sos_packets = list(self.sos_packets.values()) if sos_packets is None else sos_packets
        rain = [f.properties.rainfall_mm_hr for f in features if f.properties.layer == SpatialLayer.MOSDAC_RAIN]
        floods = [f for f in features if f.properties.layer == SpatialLayer.BHOONIDHI_FLOOD]
        threshold = settings.RAINFALL_THRESHOLD_MM_HR
        heavy = sum(rate > threshold for rate in rain)
        blocked = sum(f.properties.road_status == RoadStatus.SUBMERGED for f in features)
        flooded_area = 0.0
        for feature in floods:
            if feature.properties.water_depth_m <= 0 and not feature.properties.water_detected:
                continue
            if feature.properties.area_km2 is not None:
                flooded_area += feature.properties.area_km2
            elif feature.geometry.type == "Polygon":
                flooded_area += area_km2(feature.geometry.coordinates)
            elif feature.geometry.type == "MultiPolygon":
                flooded_area += sum(area_km2(poly) for poly in feature.geometry.coordinates)
        return StateSummaryKPIs(
            total_features=len(features) if total_features is None else total_features,
            active_sos_count=len(sos_packets),
            critical_sos_count=sum(s.triage.severity == HazardSeverity.CRITICAL for s in sos_packets),
            submerged_roads_count=blocked,
            open_corridors_count=sum(f.properties.road_status == RoadStatus.CORRIDOR for f in features),
            safe_shelters_count=sum(f.properties.asset_type == AssetType.SHELTER for f in features),
            payload_kb=self.calculate_payload_kb() if payload_kb is None else payload_kb,
            cellular_online=self.cellular_online,
            navic_locked=self.navic_locked,
            lora_mesh_active=self.lora_mesh_active,
            max_rainfall_mm_hr=round(max(rain, default=0.0), 1),
            max_water_depth_m=round(max((f.properties.water_depth_m for f in floods), default=0.0), 2),
            heavy_rain_alerts=heavy,
            flooded_area_km2=round(flooded_area, 2),
            people_at_risk=sum(s.triage.headcount for s in sos_packets),
            active_alerts=heavy + blocked + sum(
                f.properties.water_depth_m >= .5 or f.properties.water_detected is True for f in floods
            ),
            active_mesh_relays=len({relay for s in sos_packets for relay in s.mesh.relay_path})
                if self.lora_mesh_active else 0,
        )

    def get_state_response(self, region_id: str = "all-india", bbox: Bounds | None = None) -> TerraPulseStateResponse:
        region = get_regions()[region_id]
        national = region_id == "all-india"

        def feature_matches(feature):
            return (national or feature.properties.region_id == region_id) and (
                bbox is None or intersects(geometry_bounds(feature.geometry.coordinates), bbox)
            )

        def point_matches(lng, lat):
            point = (lng, lat)
            return contains(settings.india_bbox, point) and (national or contains(region.bbox, point)) and (
                bbox is None or contains(bbox, point)
            )

        selected = [f for f in self.all_features if feature_matches(f)]
        sos = [s for s in self.sos_packets.values() if point_matches(s.position.lng, s.position.lat)]
        dispatches = [d for d in self.dispatches.values() if point_matches(d.safe_asset.lng, d.safe_asset.lat)]
        metadata = self.features_collection.metadata.model_copy(update={
            "bounding_box": list(bbox or region.bbox),
            "basin_name": region.name if national else region.basin,
            "region_id": region_id,
            "generated_at": self.last_updated,
            "rainfall_threshold_mm_hr": settings.RAINFALL_THRESHOLD_MM_HR,
            "portal_provenance": self.portal_provenance,
            "scenario_mode": ScenarioMode.TELECOM_BLACKOUT_MESH if not self.cellular_online
                else self.features_collection.metadata.scenario_mode,
        })
        result = compact_collection(
            GeoJsonFeatureCollection(features=selected, metadata=metadata),
            settings.MAX_VECTOR_PAYLOAD_KB,
        )
        return TerraPulseStateResponse(
            mode=self.mode,
            features=result,
            payload_kb=result.metadata.payload_kb,
            sos_packets=[packet.public_view() for packet in sos],
            dispatches=dispatches,
            kpis=self.get_kpis(selected, sos, result.metadata.payload_kb, len(result.features)),
            last_updated=self.last_updated,
        )


state_store = TerraPulseStateStore()
