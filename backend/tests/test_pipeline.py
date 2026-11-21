import json
from pathlib import Path
import jsonschema
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_state_before_each():
    """Ensure every test runs from a pristine baseline state."""
    client.post("/api/reset")
    yield
    client.post("/api/reset")


def test_pipeline_rainfall_spike():
    """
    Simulates MOSDAC rainfall spike and verifies the full 4-portal GeoAI cascade:
    - MOSDAC rainfall rate escalates past 15.0 mm/hr threshold.
    - Bhoonidhi SAR inundation extracts water depth expansion.
    - VEDAS marks the low-lying Sevan causeway SUBMERGED while keeping ridge corridor open.
    - Bhuvan triages medical center and marks VIT shelter active.
    - Verifies that payload budget remains strictly < 100 KB.
    """
    response = client.post("/api/scenario/rainfall-spike", json={"multiplier": 4.5})
    assert response.status_code == 200
    data = response.json()

    # 1. Rainfall breach
    kpis = data["kpis"]
    assert kpis["max_rainfall_mm_hr"] >= 15.0
    assert kpis["max_water_depth_m"] >= 1.0

    # 2. Road status transition (Causeway submerged, Ridge corridor dry)
    assert kpis["submerged_roads_count"] >= 1
    assert kpis["open_corridors_count"] >= 1

    # 3. Payload size constraints (< 100 KB)
    assert data["payload_kb"] < settings.MAX_VECTOR_PAYLOAD_KB
    assert data["payload_kb"] > 0

    # 4. Feature inspection
    features = data["features"]["features"]
    causeway = next((f for f in features if f["id"] == "VEDAS-ROAD-CAUSEWAY-02"), None)
    assert causeway is not None
    assert causeway["properties"]["road_status"] == "SUBMERGED"
    assert causeway["properties"]["severity"] == "CRITICAL"

    corridor = next((f for f in features if f["id"] == "VEDAS-CORRIDOR-RIDGE-01"), None)
    assert corridor is not None
    assert corridor["properties"]["road_status"] == "CORRIDOR"
    assert corridor["properties"]["water_depth_m"] == 0.0

    # 5. Schema Conformance
    contracts_dir = settings.resolve_contracts_dir()
    with open(contracts_dir / "geojson_feature.schema.json", "r") as f:
        schema = json.load(f)
    jsonschema.validate(instance=data["features"], schema=schema)


def test_pipeline_mode_switching():
    """
    Tests transitions between NORMAL and CELL_BLACKOUT_MESH_ACTIVE.
    """
    # 1. Activate blackout
    res_blackout = client.post("/api/mode", json={"mode": "CELL_BLACKOUT_MESH_ACTIVE"})
    assert res_blackout.status_code == 200
    data_blackout = res_blackout.json()

    assert data_blackout["mode"] == "CELL_BLACKOUT_MESH_ACTIVE"
    assert data_blackout["kpis"]["cellular_online"] is False
    assert data_blackout["kpis"]["lora_mesh_active"] is True

    # 2. Restore normal connectivity
    res_normal = client.post("/api/mode", json={"mode": "NORMAL"})
    assert res_normal.status_code == 200
    data_normal = res_normal.json()

    assert data_normal["mode"] == "NORMAL"
    assert data_normal["kpis"]["cellular_online"] is True
    assert data_normal["kpis"]["lora_mesh_active"] is False


def test_pipeline_sos_ingestion():
    """
    Submits a distress SOS beacon, verifies mesh propagation and schema validation.
    """
    contracts_dir = settings.resolve_contracts_dir()
    with open(contracts_dir / "sos_packet.schema.json", "r") as f:
        sos_schema = json.load(f)

    # 1. Post new distress beacon
    payload = {
        "lat": 23.0950,
        "lng": 77.0620,
        "severity": "CRITICAL",
        "headcount": 5,
        "needs": ["BOAT_RESCUE", "MEDICAL"],
        "note": "Trapped on roof near Sevan bridge; current fast-moving.",
        "navic_band": "L5"
    }
    response = client.post("/api/sos", json=payload)
    assert response.status_code == 200
    beacon = response.json()

    assert beacon["sos_id"].startswith("SOS-")
    assert beacon["triage"]["severity"] == "CRITICAL"
    assert beacon["triage"]["headcount"] == 5
    assert beacon["mesh"]["hop_count"] >= 1
    assert "BOAT_RESCUE" in beacon["triage"]["needs"]

    # Validate against JSON schema
    jsonschema.validate(instance=beacon, schema=sos_schema)

    # 2. Verify beacon is in list
    list_res = client.get("/api/sos")
    assert list_res.status_code == 200
    beacons = list_res.json()
    assert any(b["sos_id"] == beacon["sos_id"] for b in beacons)


def test_pipeline_dispatch_creation():
    """
    Compiles an evacuation dispatch vector, verifies payload budget (<48 KB) and schema validation.
    """
    contracts_dir = settings.resolve_contracts_dir()
    with open(contracts_dir / "dispatch_vector.schema.json", "r") as f:
        dispatch_schema = json.load(f)

    payload = {
        "target_zone_id": "ZONE-KOTHRI-KALAN-SOUTH",
        "alert_headline": "FLASH FLOOD WARNING: Sevan bridge submerged. Proceed via Cartosat High-Elevation Ridge to VIT Shelter.",
        "safe_asset_name": "VIT Bhopal Auditorium & Relief Shelter (Kothri Kalan)",
        "safe_lat": 23.0805,
        "safe_lng": 77.0160
    }
    response = client.post("/api/dispatch", json=payload)
    assert response.status_code == 200
    dispatch = response.json()

    assert dispatch["dispatch_id"].startswith("DSP-")
    assert dispatch["payload_kb"] <= 48.0
    assert dispatch["target_zone_id"] == "ZONE-KOTHRI-KALAN-SOUTH"
    assert dispatch["evacuation_corridor"]["type"] == "LineString"

    # Validate against JSON schema
    jsonschema.validate(instance=dispatch, schema=dispatch_schema)

    # Verify dispatch appears in list
    list_res = client.get("/api/dispatch")
    assert list_res.status_code == 200
    dispatches = list_res.json()
    assert any(d["dispatch_id"] == dispatch["dispatch_id"] for d in dispatches)


def test_pipeline_reset_flow():
    """
    Verifies that POST /api/reset resets the state cleanly to baseline.
    """
    # Trigger spike first
    client.post("/api/scenario/rainfall-spike", json={"multiplier": 4.0})
    state_spiked = client.get("/api/state").json()
    assert state_spiked["kpis"]["submerged_roads_count"] >= 1

    # Reset
    res_reset = client.post("/api/reset")
    assert res_reset.status_code == 200
    state_reset = res_reset.json()

    assert state_reset["kpis"]["submerged_roads_count"] == 0
    assert state_reset["kpis"]["max_rainfall_mm_hr"] < 15.0
    assert state_reset["mode"] == "NORMAL"
