from datetime import datetime, timezone
from enum import Enum
from typing import Annotated, Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, ConfigDict, model_validator


# ==============================================================================
# Operational & Tactical Enums
# ==============================================================================

class OperationalMode(str, Enum):
    """Network operational mode governing backhaul and tactical mesh dispatch."""
    NORMAL = "NORMAL"
    CELL_BLACKOUT_MESH_ACTIVE = "CELL_BLACKOUT_MESH_ACTIVE"
    BACKHAUL_SYNC = "BACKHAUL_SYNC"


class ScenarioMode(str, Enum):
    """GeoAI scenario escalation stage in GeoJSON metadata."""
    BASELINE = "BASELINE"
    MOSDAC_RAIN_ALERT = "MOSDAC_RAIN_ALERT"
    BHOONIDHI_SAR_INUNDATION = "BHOONIDHI_SAR_INUNDATION"
    VEDAS_DEM_CORRIDORS = "VEDAS_DEM_CORRIDORS"
    TELECOM_BLACKOUT_MESH = "TELECOM_BLACKOUT_MESH"


class SpatialLayer(str, Enum):
    """The 5 authoritative GeoAI intelligence layers."""
    MOSDAC_RAIN = "mosdac_rain"
    BHOONIDHI_FLOOD = "bhoonidhi_flood"
    VEDAS_ROADS = "vedas_roads"
    VEDAS_CORRIDORS = "vedas_corridors"
    BHUVAN_ASSETS = "bhuvan_assets"


class HazardSeverity(str, Enum):
    """Standardized 4-tier hazard and triage severity."""
    LOW = "LOW"
    MODERATE = "MODERATE"
    HIGH = "HIGH"
    CRITICAL = "CRITICAL"


class RoadStatus(str, Enum):
    """VEDAS hydrological road accessibility classification."""
    OPEN = "OPEN"
    SUBMERGED = "SUBMERGED"
    CORRIDOR = "CORRIDOR"
    NA = "NA"


class AssetType(str, Enum):
    """Bhuvan cadastral infrastructure taxonomy."""
    HOSPITAL = "HOSPITAL"
    SCHOOL = "SCHOOL"
    GRAM_PANCHAYAT = "GRAM_PANCHAYAT"
    SHELTER = "SHELTER"
    RESERVOIR = "RESERVOIR"
    NONE = "NONE"


class NavicBand(str, Enum):
    """Indigenous Indian Satellite Navigation constellation frequency bands."""
    L5 = "L5"
    S_BAND = "S_BAND"
    L5_S_DUAL = "L5_S_DUAL"
    L5_S_PASSIVE = "L5+S_PASSIVE"
    DEVICE_GPS = "DEVICE_GPS"
    ESTIMATED_MESH = "ESTIMATED_MESH"


class MeshTransport(str, Enum):
    """Physical radio layer for off-grid tactical relays."""
    LORA_865 = "LORA_865"
    LORA_867 = "LORA_867"
    BLE_MESH = "BLE_MESH"
    DIRECT_NAVIC_SMS = "DIRECT_NAVIC_SMS"


class MeshSyncStatus(str, Enum):
    """Lifecycle status of off-grid distress beacon propagation."""
    QUEUED_OFFLINE = "QUEUED_OFFLINE"
    RELAYED_MESH = "RELAYED_MESH"
    SYNCED_COMMAND = "SYNCED_COMMAND"


# ==============================================================================
# GeoJSON Feature Collection Models (geojson_feature.schema.json)
# ==============================================================================

class LayerProvenance(BaseModel):
    """Provenance tracking per authoritative ISRO spatial layer."""
    model_config = ConfigDict(extra="allow")

    source_portal: str  # "MOSDAC", "Bhoonidhi", "VEDAS", "Bhuvan"
    ingestion_mode: str = "seed_fallback"  # "live_portal", "local_sample", "seed_fallback", "simulation_spike"
    sensor: Optional[str] = None
    status: str = "SYNCHRONIZED"
    features_count: int = 0
    updated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PortalProvenance(BaseModel):
    source_type: Literal["live_portal", "local_sample", "seed_fallback"]
    records_ingested: int = Field(ge=0)
    last_synced_at: str


class GeoJsonMetadata(BaseModel):
    model_config = ConfigDict(extra="allow")

    source_portal: str = "TerraPulse_GeoAI"
    generated_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    payload_kb: float = 0.0
    scenario_mode: ScenarioMode = ScenarioMode.BASELINE
    rainfall_threshold_mm_hr: float = 15.0
    basin_name: Optional[str] = "Kothri Kalan / Sehore / Bhopal Basin (Madhya Pradesh)"
    bounding_box: Optional[List[float]] = [77.01, 23.07, 77.43, 23.27]
    layer_provenance: Optional[Dict[str, LayerProvenance]] = None
    portal_provenance: Optional[Dict[str, PortalProvenance]] = None
    region_id: str = "all-india"
    total_records: int | None = None
    truncated: bool = False


class GeoJsonGeometry(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str  # Polygon, MultiPolygon, LineString, Point
    coordinates: Any


class GeoJsonFeatureProperties(BaseModel):
    model_config = ConfigDict(extra="allow")

    layer: SpatialLayer
    title: str
    hazard_type: str = "NONE"
    severity: HazardSeverity = HazardSeverity.LOW
    rainfall_mm_hr: float = 0.0
    water_depth_m: float = 0.0
    road_status: RoadStatus = RoadStatus.NA
    asset_type: AssetType = AssetType.NONE
    evacuation_priority: int = Field(ge=1, le=5, default=1)
    recommended_action: str
    elevation_m: Optional[float] = None
    capacity: Optional[int] = None
    sensor: Optional[str] = None
    data_source_origin: Optional[str] = None
    source_portal: Optional[str] = None
    region_id: Optional[str] = None
    place_name: Optional[str] = None
    observed_at: Optional[str] = None
    area_km2: Optional[float] = Field(default=None, ge=0)
    water_detected: Optional[bool] = None
    soil_moisture_pct: Optional[float] = Field(default=None, ge=0, le=100)
    wind_km_hr: Optional[float] = Field(default=None, ge=0)
    storage_pct: Optional[float] = Field(default=None, ge=0, le=100)
    capacity_mcm: Optional[float] = Field(default=None, ge=0)
    crop_stress_pct: Optional[float] = Field(default=None, ge=0, le=100)
    record_kind: Optional[str] = None
    boundary_type: Optional[str] = None
    land_use: Optional[str] = None
    clearance_m: Optional[float] = Field(default=None, ge=0)
    slope_pct: Optional[float] = Field(default=None, ge=0)


class GeoJsonFeature(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str = "Feature"
    id: Optional[str] = None
    geometry: GeoJsonGeometry
    properties: GeoJsonFeatureProperties


class GeoJsonFeatureCollection(BaseModel):
    model_config = ConfigDict(extra="allow")

    type: str = "FeatureCollection"
    metadata: GeoJsonMetadata
    features: List[GeoJsonFeature] = Field(default_factory=list)


# ==============================================================================
# SOS Distress Packet Models (sos_packet.schema.json)
# ==============================================================================

class PositionModel(BaseModel):
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)
    accuracy_m: float = Field(default=5.0, gt=0, le=100_000)
    navic_band: NavicBand = NavicBand.L5


class TriageModel(BaseModel):
    severity: HazardSeverity = HazardSeverity.MODERATE
    headcount: int = Field(ge=1, le=10_000, default=1)
    needs: list[Annotated[str, Field(min_length=1, max_length=32)]] = Field(default_factory=list, max_length=10)
    note: Optional[str] = Field(default=None, max_length=240)


class MeshModel(BaseModel):
    transport: MeshTransport = MeshTransport.LORA_865
    hop_count: int = Field(ge=0, le=15, default=0)
    max_hops: int = Field(ge=1, le=15, default=7)
    relay_path: list[Annotated[str, Field(min_length=1, max_length=40)]] = Field(default_factory=list, max_length=16)
    sync_status: MeshSyncStatus = MeshSyncStatus.QUEUED_OFFLINE


class SOSPacket(BaseModel):
    model_config = ConfigDict(extra="ignore")

    sos_id: str = Field(pattern=r"^SOS-[A-Z0-9_-]{4,20}$")
    device_id: str = Field(min_length=1, max_length=64)
    timestamp: str = Field(max_length=40, default_factory=lambda: datetime.now(timezone.utc).isoformat())
    position: PositionModel
    triage: TriageModel
    mesh: MeshModel

    @model_validator(mode="after")
    def validate_hops(self) -> "SOSPacket":
        if self.mesh.hop_count > self.mesh.max_hops:
            raise ValueError("hop_count must be at most max_hops")
        return self


# ==============================================================================
# Dispatch Vector Models (dispatch_vector.schema.json)
# ==============================================================================

class SafeAsset(BaseModel):
    name: str
    lat: float = Field(ge=-90.0, le=90.0)
    lng: float = Field(ge=-180.0, le=180.0)
    asset_id: Optional[str] = None


class DispatchVector(BaseModel):
    model_config = ConfigDict(extra="allow")

    dispatch_id: str = Field(pattern=r"^DSP-[A-Z0-9_-]{4,16}$")
    issued_at: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    mode: OperationalMode = OperationalMode.NORMAL
    target_zone_id: str
    alert_headline: str
    evacuation_corridor: GeoJsonGeometry
    safe_asset: SafeAsset
    payload_kb: float = Field(le=48.0, default=1.0)


# ==============================================================================
# Unified Central Command State Response & KPIs
# ==============================================================================

class StateSummaryKPIs(BaseModel):
    total_features: int = 0
    active_sos_count: int = 0
    critical_sos_count: int = 0
    submerged_roads_count: int = 0
    open_corridors_count: int = 0
    safe_shelters_count: int = 0
    payload_kb: float = 0.0
    cellular_online: bool = True
    navic_locked: bool = True
    lora_mesh_active: bool = False
    max_rainfall_mm_hr: float = 0.0
    max_water_depth_m: float = 0.0
    heavy_rain_alerts: int = 0
    flooded_area_km2: float = 0.0
    people_at_risk: int = 0
    active_alerts: int = 0
    active_mesh_relays: int = 0


class TerraPulseStateResponse(BaseModel):
    mode: OperationalMode
    features: GeoJsonFeatureCollection
    payload_kb: float
    sos_packets: List[SOSPacket] = Field(default_factory=list)
    dispatches: List[DispatchVector] = Field(default_factory=list)
    kpis: StateSummaryKPIs
    last_updated: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
