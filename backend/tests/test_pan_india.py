import json

import httpx
import jsonschema
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.schemas import GeoJsonFeature, GeoJsonGeometry, HazardSeverity
from app.models.state import state_store
from app.services.mosdac_service import mosdac_service


@pytest.fixture
def client():
    state_store.reset_to_baseline()
    with TestClient(app) as client:
        yield client
    state_store.reset_to_baseline()


def test_all_india_and_combined_bbox(client):
    regions = client.get("/api/regions").json()
    assert len(regions) == 8
    assert regions[0]["center"] == [78.96, 22.59]
    assert regions[0]["bbox"] == [68.0, 6.5, 97.5, 37.5]
    for region in regions[1:]:
        scoped = client.get("/api/state", params={"region": region["id"]}).json()
        assert scoped["features"]["metadata"]["region_id"] == region["id"]
        assert all(feature["properties"]["region_id"] == region["id"] for feature in scoped["features"]["features"])
        assert {feature["properties"]["source_portal"] for feature in scoped["features"]["features"]} == {
            "MOSDAC", "Bhoonidhi", "VEDAS", "Bhuvan",
        }
    result = client.get("/api/state", params={"region": "northeast-india", "bbox": "91.70,26.12,91.78,26.19"}).json()
    assert any("Guwahati" in f["properties"]["title"] for f in result["features"]["features"])
    assert all("Dhemaji" not in f["properties"]["title"] for f in result["features"]["features"])
    assert client.get("/api/state", params={"bbox": "NaN,25,90,28"}).status_code == 422
    assert client.get("/api/state", params={"region": "unknown"}).status_code == 404


def test_sync_provenance_and_regional_exercise(client):
    initial = client.post("/api/ingest/sync").json()
    for portal in initial["features"]["metadata"]["portal_provenance"].values():
        assert portal["source_type"] == "local_sample"
        assert portal["last_synced_at"] and portal["records_ingested"] > 0
    before = client.get("/api/state", params={"region": "central-india"}).json()["kpis"]
    response = client.post("/api/scenario/rainfall-spike", json={"region": "northeast-india", "rainfall_mm_hr": 34})
    assert response.status_code == 200
    data = response.json()
    assert data["kpis"]["heavy_rain_alerts"] > 0
    assert data["kpis"]["submerged_roads_count"] > 0
    after = client.get("/api/state", params={"region": "central-india"}).json()["kpis"]
    assert before["max_rainfall_mm_hr"] == after["max_rainfall_mm_hr"]
    dispatch = client.post("/api/dispatch", json={"region": "northeast-india"})
    assert dispatch.status_code == 200
    assert "Guwahati" in dispatch.json()["safe_asset"]["name"]
    assert len(dispatch.content) < 48_000


def test_large_snapshot_is_compact_without_pruning_source(client):
    template = next(feature for feature in state_store.all_features if feature.properties.layer == "mosdac_rain")
    for index in range(400):
        properties = template.properties.model_copy(update={
            "severity": HazardSeverity.CRITICAL, "title": "Exercise rain " + "x" * 180,
        })
        state_store.regional_features.append(GeoJsonFeature(
            id=f"SIZE-{index}",
            geometry=GeoJsonGeometry(type="Point", coordinates=[91.74, 26.17]),
            properties=properties.model_copy(update={"region_id": "northeast-india"}),
        ))
    original = len(state_store.all_features)
    compact = client.get("/api/state").json()["features"]
    wire = json.dumps(compact, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    assert compact["metadata"]["truncated"]
    assert compact["metadata"]["total_records"] == original
    assert len(wire) < 100_000
    assert len(state_store.all_features) == original
    assert len({f["properties"]["region_id"] for f in compact["features"]}) >= 7
    with (settings.resolve_contracts_dir() / "geojson_feature.schema.json").open(encoding="utf-8") as file:
        jsonschema.validate(compact, json.load(file))


def test_sos_batch_retry_and_websocket(client):
    packet = client.get("/api/sos").json()[0]
    packet["sos_id"] = "SOS-REGIONAL-QA"
    packet["position"] = {"lat": 26.145, "lng": 91.738, "accuracy_m": 4.5, "navic_band": "L5+S_PASSIVE"}
    packet["mesh"].update(hop_count=0, relay_path=[], sync_status="QUEUED_OFFLINE")
    with client.websocket_connect("/ws/live") as socket:
        assert socket.receive_json()["event"] == "connected"
        assert client.post("/api/mode", json={"mode": "CELL_BLACKOUT_MESH_ACTIVE"}).status_code == 200
        assert socket.receive_json()["event"] == "state_updated"
        first = client.post("/api/sos", json=[packet]).json()[0]
        assert first["mesh"]["sync_status"] == "RELAYED_MESH"
        assert socket.receive_json()["event"] == "sos_received"
        second = client.post("/api/sos", json=[packet]).json()[0]
        assert first == second
        assert client.post("/api/mode", json={"mode": "BACKHAUL_SYNC"}).status_code == 200
        assert socket.receive_json()["event"] == "state_updated"
        synced = client.post("/api/sos", json=packet).json()
        assert synced["mesh"]["sync_status"] == "SYNCED_COMMAND"
        assert synced["mesh"]["hop_count"] == first["mesh"]["hop_count"]
        assert client.post("/api/dispatch", json={"region": "northeast-india"}).status_code == 200
        assert socket.receive_json()["event"] == "dispatch_pushed"


def test_mosdac_rss_and_html_fallback(monkeypatch, tmp_path):
    rss = b"""<rss xmlns:georss="http://www.georss.org/georss"><channel>
      <item><title>Darbhanga rain</title><georss:point>26.15 85.89</georss:point>
      <rainfall_mm_hr>18.7</rainfall_mm_hr><wind_km_hr>39</wind_km_hr></item>
      </channel></rss>"""
    file = tmp_path / "rain.rss"
    file.write_bytes(rss)
    real_client = httpx.Client

    def serve(request):
        if request.url.path == "/weather":
            return httpx.Response(200, content=rss, headers={"content-type": "application/rss+xml"})
        return httpx.Response(200, content=b"<html>Log in</html>", headers={"content-type": "text/html"})

    monkeypatch.setattr(httpx, "Client", lambda **kwargs: real_client(transport=httpx.MockTransport(serve), **kwargs))
    live, live_source = mosdac_service.load_records("https://portal.example/weather", file)
    assert live_source == "live_portal"
    assert live[0].geometry.coordinates == [85.89, 26.15]
    assert live[0].properties.wind_km_hr == 39
    sample, sample_source = mosdac_service.load_records("https://portal.example/login", file)
    assert sample_source == "local_sample"
    assert sample[0].properties.rainfall_mm_hr == 18.7
