import json
from pathlib import Path
import jsonschema
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.state import state_store

client = TestClient(app)


def test_root_index():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "OPERATIONAL"
    assert "Kothri Kalan" in data["catchment_basin"]


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert "MOSDAC" in data["portals"]
    assert "Bhoonidhi" in data["portals"]
    assert "VEDAS" in data["portals"]
    assert "Bhuvan" in data["portals"]
    assert data["features_loaded"] >= 5
    assert data["payload_kb"] > 0


def test_api_health_alias():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "HEALTHY"


def test_get_state():
    response = client.get("/api/state")
    assert response.status_code == 200
    data = response.json()

    # 1. Mode and Metadata
    assert data["mode"] == "NORMAL"
    assert data["payload_kb"] < settings.MAX_VECTOR_PAYLOAD_KB

    # 2. Features collection
    features = data["features"]["features"]
    assert len(features) >= 5

    layers = set(f["properties"]["layer"] for f in features)
    assert "mosdac_rain" in layers
    assert "bhoonidhi_flood" in layers
    assert "vedas_roads" in layers
    assert "vedas_corridors" in layers
    assert "bhuvan_assets" in layers

    # 3. Seeded SOS beacons (Kothri Kalan basin)
    assert len(data["sos_packets"]) >= 2
    sos_ids = [s["sos_id"] for s in data["sos_packets"]]
    assert "SOS-20261121-0042" in sos_ids
    assert "SOS-20261121-0089" in sos_ids

    # 4. Seeded Dispatch Vector
    assert len(data["dispatches"]) >= 1
    assert data["dispatches"][0]["dispatch_id"] == "DSP-KOTHRI-VEC-01"
    assert "VIT Bhopal" in data["dispatches"][0]["safe_asset"]["name"]

    # 5. KPIs
    kpis = data["kpis"]
    assert kpis["total_features"] == len(features)
    assert kpis["active_sos_count"] >= 2
    assert kpis["critical_sos_count"] >= 1
    assert kpis["cellular_online"] is True
    assert kpis["navic_locked"] is True


def test_reset_state():
    # Mutate state temporarily
    state_store.mode = "CELL_BLACKOUT_MESH_ACTIVE"
    state_store.cellular_online = False

    # Call reset
    response = client.post("/api/state/reset")
    assert response.status_code == 200
    data = response.json()

    assert data["mode"] == "NORMAL"
    assert data["kpis"]["cellular_online"] is True
    assert len(data["sos_packets"]) == 2


def test_validate_state_against_contracts():
    """Validates runtime state payloads against Phase 1 JSON schemas."""
    contracts_dir = settings.resolve_contracts_dir()
    assert contracts_dir.exists(), f"Contracts directory missing: {contracts_dir}"

    # Load contract schemas
    with open(contracts_dir / "geojson_feature.schema.json", "r") as f:
        geojson_schema = json.load(f)
    with open(contracts_dir / "sos_packet.schema.json", "r") as f:
        sos_schema = json.load(f)
    with open(contracts_dir / "dispatch_vector.schema.json", "r") as f:
        dispatch_schema = json.load(f)

    response = client.get("/api/state")
    data = response.json()

    # 1. Validate GeoJSON FeatureCollection
    jsonschema.validate(instance=data["features"], schema=geojson_schema)

    # 2. Validate SOS Packets
    for sos in data["sos_packets"]:
        jsonschema.validate(instance=sos, schema=sos_schema)

    # 3. Validate Dispatch Vectors
    for dispatch in data["dispatches"]:
        jsonschema.validate(instance=dispatch, schema=dispatch_schema)
