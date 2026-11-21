import json
from pathlib import Path
import jsonschema
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.schemas import (
    AssetType,
    HazardSeverity,
    OperationalMode,
    RoadStatus,
    ScenarioMode,
    SpatialLayer,
)
from app.models.state import state_store

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_state_before_each():
    """Ensure clean baseline state before and after every test."""
    client.post("/api/reset")
    yield
    client.post("/api/reset")


# ==============================================================================
# 1. Unified Space-to-Ground Cascade via POST /api/scenario/rainfall-spike
# ==============================================================================

def test_unified_cascade_rainfall_spike_all_four_portals():
    """
    Verifies that POST /api/scenario/rainfall-spike triggers the full 4-portal cascade:
    1. MOSDAC: INSAT-3DS rain > 15 mm/hr alert threshold.
    2. Bhoonidhi: EOS-04 C-band SAR backscatter drop & flood polygon expansion.
    3. VEDAS: Cartosat DEM drainage runoff - low causeway SUBMERGED, ridge CORRIDOR open.
    4. Bhuvan: Hospital emergency intake, VIT Bhopal shelter primary destination, checkdam surcharge.
    5. Layer provenance is reported per layer in metadata.
    6. Payload budget < 100 KB is strictly enforced.
    """
    res = client.post("/api/scenario/rainfall-spike", json={"multiplier": 4.5, "rainfall_mm_hr": 22.5})
    assert res.status_code == 200
    data = res.json()

    # A. Payload Budget Verification (< 100 KB)
    assert data["payload_kb"] < settings.MAX_VECTOR_PAYLOAD_KB
    assert data["payload_kb"] > 0
    assert data["features"]["metadata"]["payload_kb"] == data["payload_kb"]

    # B. Metadata & Provenance Verification
    metadata = data["features"]["metadata"]
    assert metadata["source_portal"] == "TerraPulse_GeoAI"
    assert metadata["scenario_mode"] in (ScenarioMode.VEDAS_DEM_CORRIDORS.value, ScenarioMode.BHOONIDHI_SAR_INUNDATION.value)
    assert metadata["rainfall_threshold_mm_hr"] == 15.0

    provenance = metadata.get("layer_provenance")
    assert provenance is not None, "Metadata must contain layer_provenance"
    for layer_key in ["mosdac_rain", "bhoonidhi_flood", "vedas_roads", "vedas_corridors", "bhuvan_assets"]:
        assert layer_key in provenance, f"Missing layer {layer_key} in layer_provenance"
        prov = provenance[layer_key]
        assert prov["source_portal"] in ["MOSDAC", "Bhoonidhi", "VEDAS", "Bhuvan"]
        assert prov["status"] == "SYNCHRONIZED"
        assert prov["ingestion_mode"] in ["simulation_spike", "local_sample", "seed_fallback", "live_portal"]

    # C. Inspect Features across all 4 Portals
    features = data["features"]["features"]
    assert len(features) >= 5

    # 1. MOSDAC Rain Layer
    rain_features = [f for f in features if f["properties"]["layer"] == SpatialLayer.MOSDAC_RAIN.value]
    assert len(rain_features) >= 1
    assert any(f["properties"]["rainfall_mm_hr"] >= 15.0 for f in rain_features)
    assert any(f["properties"]["hazard_type"] == "FLASH_FLOOD_CLOUD_BURST" for f in rain_features)
    assert any(f["properties"]["source_portal"] == "MOSDAC" for f in rain_features)

    # 2. Bhoonidhi SAR Flood Layer
    flood_features = [f for f in features if f["properties"]["layer"] == SpatialLayer.BHOONIDHI_FLOOD.value]
    assert len(flood_features) >= 1
    assert any(f["properties"]["water_depth_m"] >= 1.0 for f in flood_features)
    assert any(f["properties"]["severity"] in ("HIGH", "CRITICAL") for f in flood_features)
    assert any(f["properties"]["source_portal"] == "Bhoonidhi" for f in flood_features)

    # 3. VEDAS Roads & Corridors Layer
    causeway = next((f for f in features if f["id"] == "VEDAS-ROAD-CAUSEWAY-02"), None)
    assert causeway is not None
    assert causeway["properties"]["road_status"] == RoadStatus.SUBMERGED.value
    assert causeway["properties"]["severity"] == HazardSeverity.CRITICAL.value
    assert causeway["properties"]["water_depth_m"] >= 1.0
    assert causeway["properties"]["source_portal"] == "VEDAS"

    corridor = next((f for f in features if f["id"] == "VEDAS-CORRIDOR-RIDGE-01"), None)
    assert corridor is not None
    assert corridor["properties"]["road_status"] == RoadStatus.CORRIDOR.value
    assert corridor["properties"]["water_depth_m"] == 0.0
    assert corridor["properties"]["source_portal"] == "VEDAS"

    # 4. Bhuvan Critical Infrastructure Layer
    hospital = next((f for f in features if f["properties"]["asset_type"] == AssetType.HOSPITAL.value), None)
    assert hospital is not None
    assert hospital["properties"]["severity"] == HazardSeverity.HIGH.value
    assert "EMERGENCY MEDICAL TRIAGE ACTIVE" in hospital["properties"]["recommended_action"]
    assert hospital["properties"]["source_portal"] == "Bhuvan"

    shelter = next((f for f in features if f["properties"]["asset_type"] == AssetType.SHELTER.value), None)
    assert shelter is not None
    assert "PRIMARY EVACUATION DESTINATION ACTIVE" in shelter["properties"]["recommended_action"]
    assert shelter["properties"]["water_depth_m"] == 0.0
    assert shelter["properties"]["source_portal"] == "Bhuvan"

    reservoir = next((f for f in features if f["properties"]["layer"] == SpatialLayer.BHUVAN_ASSETS.value and f["properties"]["asset_type"] == AssetType.RESERVOIR.value), None)
    if reservoir:
        assert reservoir["properties"]["severity"] == HazardSeverity.CRITICAL.value
        assert "RESERVOIR SURCHARGE WARNING" in reservoir["properties"]["recommended_action"]
        assert reservoir["properties"]["source_portal"] == "Bhuvan"

    # D. Active Dispatch Vector Updated
    assert len(data["dispatches"]) >= 1
    disp = data["dispatches"][0]
    assert "VIT Bhopal" in disp["safe_asset"]["name"]
    assert "Sevan causeway submerged" in disp["alert_headline"]

    # E. Contract Schema Validation
    contracts_dir = settings.resolve_contracts_dir()
    with open(contracts_dir / "geojson_feature.schema.json", "r") as f:
        schema = json.load(f)
    jsonschema.validate(instance=data["features"], schema=schema)


# ==============================================================================
# 2. MOSDAC Ingestion with Threshold Breach Auto-Cascading
# ==============================================================================

def test_mosdac_sample_ingest_auto_cascades_on_breach():
    """
    Verifies that ingesting real/sample MOSDAC precipitation where max_rainfall >= 15 mm/hr
    automatically triggers the downstream cascade into Bhoonidhi, VEDAS, and Bhuvan.
    """
    res = client.post("/api/portal/mosdac/ingest")
    assert res.status_code == 200
    summary = res.json()

    assert summary["features_ingested"] >= 1
    assert summary["max_rainfall_mm_hr"] >= 15.0
    assert summary["anomaly_detected"] is True

    # Check state response after MOSDAC ingestion
    state_res = client.get("/api/state")
    assert state_res.status_code == 200
    state_data = state_res.json()

    kpis = state_data["kpis"]
    assert kpis["max_rainfall_mm_hr"] >= 15.0
    assert kpis["submerged_roads_count"] >= 1
    assert kpis["open_corridors_count"] >= 1

    # Causeway submerged
    features = state_data["features"]["features"]
    causeway = next((f for f in features if f["id"] == "VEDAS-ROAD-CAUSEWAY-02"), None)
    assert causeway is not None
    assert causeway["properties"]["road_status"] == RoadStatus.SUBMERGED.value


# ==============================================================================
# 3. Payload Budget Enforcement (< 100 KB)
# ==============================================================================

def test_payload_budget_under_100kb_enforcement():
    """
    Verifies that the state store's enforce_payload_budget ensures the payload
    remains strictly within < 100 KB even under complex geometries.
    """
    # Trigger cascade
    client.post("/api/scenario/rainfall-spike", json={"multiplier": 5.0})

    # Read current payload
    payload_kb = state_store.calculate_payload_kb()
    assert payload_kb < settings.MAX_VECTOR_PAYLOAD_KB
    assert payload_kb > 0

    # Explicit enforcement check
    enforced_kb = state_store.enforce_payload_budget(max_kb=100.0)
    assert enforced_kb <= 100.0
    assert state_store.features_collection.metadata.payload_kb == enforced_kb


# ==============================================================================
# 4. Resilience & Graceful Degradation on Malformed / Missing Sources
# ==============================================================================

def test_resilience_missing_and_malformed_sources():
    """
    Ensures that supplying non-existent URLs or paths to all four portal services
    degrades gracefully without uncaught exceptions, maintaining a valid state response.
    """
    # Missing / unreachable endpoints
    res_mosdac = client.post("/api/portal/mosdac/ingest?override_url=http://127.0.0.1:59999/nonexistent")
    assert res_mosdac.status_code == 200

    res_bhoonidhi = client.post("/api/portal/bhoonidhi/ingest?override_url=http://127.0.0.1:59999/nonexistent")
    assert res_bhoonidhi.status_code == 200

    res_bhuvan = client.post("/api/portal/bhuvan/ingest?override_url=http://127.0.0.1:59999/nonexistent")
    assert res_bhuvan.status_code == 200

    # Ensure state is intact and valid
    state_res = client.get("/api/state")
    assert state_res.status_code == 200
    data = state_res.json()
    assert data["payload_kb"] < 100.0
    assert len(data["features"]["features"]) >= 5


# ==============================================================================
# 5. Full Endpoints Suite Verification
# ==============================================================================

def test_full_endpoints_verification():
    """
    Verifies clean behavior across all core API endpoints:
    - GET /health
    - GET /api/health
    - GET /api/state
    - POST /api/scenario/rainfall-spike
    - POST /api/mode
    - POST /api/sos
    - POST /api/dispatch
    - POST /api/reset
    """
    # 1. Health
    h1 = client.get("/health")
    assert h1.status_code == 200
    assert h1.json()["status"] == "HEALTHY"
    assert "MOSDAC" in h1.json()["portals"]

    h2 = client.get("/api/health")
    assert h2.status_code == 200
    assert h2.json()["status"] == "HEALTHY"

    # 2. State
    st = client.get("/api/state")
    assert st.status_code == 200
    assert st.json()["mode"] == "NORMAL"
    assert st.json()["payload_kb"] < 100.0

    # 3. Rainfall Spike
    sp = client.post("/api/scenario/rainfall-spike", json={"multiplier": 4.0})
    assert sp.status_code == 200
    assert sp.json()["kpis"]["max_rainfall_mm_hr"] >= 15.0

    # 4. Mode Change
    m1 = client.post("/api/mode", json={"mode": "CELL_BLACKOUT_MESH_ACTIVE"})
    assert m1.status_code == 200
    assert m1.json()["mode"] == "CELL_BLACKOUT_MESH_ACTIVE"
    assert m1.json()["kpis"]["cellular_online"] is False
    assert m1.json()["kpis"]["lora_mesh_active"] is True

    m2 = client.post("/api/mode", json={"mode": "NORMAL"})
    assert m2.status_code == 200
    assert m2.json()["mode"] == "NORMAL"

    # 5. SOS Distress Ingestion
    sos_res = client.post("/api/sos", json={
        "lat": 23.0905,
        "lng": 77.0570,
        "severity": "CRITICAL",
        "headcount": 5,
        "needs": ["EVACUATION", "MEDICAL"],
        "note": "Field triage test near Sevan River causeway",
    })
    assert sos_res.status_code == 200
    assert sos_res.json()["sos_id"].startswith("SOS-")

    # 6. Dispatch Push
    disp_res = client.post("/api/dispatch", json={
        "target_zone_id": "ZONE-KOTHRI-KALAN-NORTH",
        "alert_headline": "Move north along Cartosat Ridge Corridor to VIT Bhopal shelter",
        "safe_asset_name": "VIT Bhopal Auditorium",
        "safe_lat": 23.0805,
        "safe_lng": 77.0160,
    })
    assert disp_res.status_code == 200
    assert disp_res.json()["dispatch_id"].startswith("DSP-")

    # 7. Reset
    rst = client.post("/api/reset")
    assert rst.status_code == 200
    assert rst.json()["mode"] == "NORMAL"
    assert rst.json()["kpis"]["cellular_online"] is True
