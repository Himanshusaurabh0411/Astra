import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.schemas import RoadStatus, SpatialLayer
from app.models.state import state_store
from app.services.mosdac_service import mosdac_service
from app.services.vedas_service import vedas_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_state_before_each():
    """Ensure state store is reset to baseline before and after each test."""
    state_store.reset_to_baseline()
    yield
    state_store.reset_to_baseline()


def test_mosdac_sample_json_ingestion():
    """
    Verifies that real MOSDAC INSAT-3DS JSON sample parses correctly:
    - Normalizes into mosdac_rain GeoJsonFeatures
    - Flags rainfall exceeding 15.0 mm/hr threshold
    - Tags features with data_source_origin = 'local_sample'
    """
    sample_path = settings.resolve_mosdac_sample_path()
    assert sample_path is not None, "MOSDAC sample path should be resolvable"
    assert sample_path.exists(), f"MOSDAC sample file missing at {sample_path}"

    summary = mosdac_service.ingest_rainfall_data(override_path=sample_path)
    assert summary["source_origin"] == "local_sample"
    assert summary["features_ingested"] >= 1
    assert summary["max_rainfall_mm_hr"] >= 15.0
    assert summary["anomaly_detected"] is True
    assert summary["sar_tasking_recommended"] is True

    # State store inspection
    features = state_store.features_collection.features
    rain_features = [f for f in features if f.properties.layer == SpatialLayer.MOSDAC_RAIN]
    assert len(rain_features) >= 1
    for rf in rain_features:
        assert rf.properties.data_source_origin == "local_sample"

    # Verify high-rainfall cell
    breached_cell = next((f for f in rain_features if f.properties.rainfall_mm_hr >= 15.0), None)
    assert breached_cell is not None
    assert breached_cell.properties.severity in ("HIGH", "CRITICAL")
    assert breached_cell.properties.hazard_type == "FLASH_FLOOD_CLOUD_BURST"


def test_mosdac_sample_csv_ingestion():
    """
    Verifies that tabular GSMaP_ISRO precipitation CSV sample parses into polygons.
    """
    app_dir = Path(__file__).resolve().parent.parent / "app"
    csv_path = app_dir / "data" / "real_samples" / "mosdac" / "gsmap_isro_precip_catchment.csv"
    assert csv_path.exists(), f"GSMaP CSV sample missing at {csv_path}"

    summary = mosdac_service.ingest_rainfall_data(override_path=csv_path)
    assert summary["source_origin"] == "local_sample"
    assert summary["features_ingested"] >= 4
    assert summary["max_rainfall_mm_hr"] >= 15.0

    # Ensure geometry was generated as Polygon bounds
    rain_features = [
        f for f in state_store.features_collection.features
        if f.properties.layer == SpatialLayer.MOSDAC_RAIN
    ]
    assert any(f.geometry.type == "Polygon" for f in rain_features)


def test_mosdac_live_and_local_fallback():
    """
    Verifies fallback when live portal URL and local file fail or are missing:
    - Reverts gracefully to 'seed_fallback' baseline
    - Never raises unhandled exceptions
    """
    summary = mosdac_service.ingest_rainfall_data(
        override_url="http://127.0.0.1:59999/unreachable_endpoint",
        override_path=Path("nonexistent_mosdac_data.json"),
    )
    assert summary["source_origin"] == "seed_fallback"
    assert summary["features_ingested"] >= 1
    assert "max_rainfall_mm_hr" in summary


def test_vedas_cartosat_roads_profile_ingestion():
    """
    Verifies that real VEDAS Cartosat DEM roads JSON parses correctly:
    - Identifies low causeway (<470m) and marks SUBMERGED under flood conditions
    - Identifies high ridge corridor (>510m) and marks CORRIDOR (dry evacuation path)
    - Sets source_origin = 'local_sample'
    """
    sample_path = settings.resolve_vedas_sample_path()
    assert sample_path is not None, "VEDAS roads sample path should be resolvable"
    assert sample_path.exists(), f"VEDAS roads sample missing at {sample_path}"

    summary = vedas_service.ingest_terrain_and_roads(
        override_path=sample_path,
        water_depth_m=1.2,
        rainfall_mm_hr=18.5,
    )
    assert summary["source_origin"] == "local_sample"
    assert summary["roads_evaluated"] >= 3
    assert summary["submerged_roads"] >= 1
    assert summary["open_corridors"] >= 1

    # Inspect state store features
    features = state_store.features_collection.features
    causeway = next((f for f in features if f.id == "VEDAS-ROAD-CAUSEWAY-02"), None)
    assert causeway is not None
    assert causeway.properties.road_status == RoadStatus.SUBMERGED
    assert causeway.properties.water_depth_m > 0
    assert causeway.properties.data_source_origin == "local_sample"

    corridor = next((f for f in features if f.id == "VEDAS-CORRIDOR-RIDGE-01"), None)
    assert corridor is not None
    assert corridor.properties.road_status == RoadStatus.CORRIDOR
    assert corridor.properties.elevation_m >= 510.0
    assert corridor.properties.water_depth_m == 0.0


def test_vedas_crop_stress_and_pmfby_summary():
    """
    Verifies that VEDAS crop condition & PMFBY parametric insurance data parses correctly:
    - Calculates total inundated hectares across Sehore / Bhopal rural sectors
    - Exposes NDVI anomaly and eligible blocks for automated relief claims
    """
    agri_path = settings.resolve_vedas_agri_sample_path()
    assert agri_path is not None
    assert agri_path.exists()

    blocks = vedas_service.ingest_crop_stress_data(override_path=agri_path)
    assert len(blocks) >= 3

    summary = vedas_service.get_crop_stress_summary()
    assert summary["total_blocks_monitored"] >= 3
    assert summary["total_inundated_hectares"] >= 1000.0
    assert "Kothri Kalan / Sehore Rural" in summary["pmfby_eligible_blocks"]
    assert summary["avg_ndvi_anomaly_pct"] < 0.0  # negative NDVI anomaly indicates waterlogging stress


def test_vedas_missing_file_fallback():
    """
    Verifies clean fallback when Cartosat DEM sample file is absent.
    """
    summary = vedas_service.ingest_terrain_and_roads(
        override_url="http://127.0.0.1:59999/unreachable_vedas",
        override_path=Path("nonexistent_vedas_dem.json"),
        water_depth_m=0.0,
    )
    assert summary["source_origin"] == "seed_fallback"
    assert "submerged_roads" in summary
    assert "open_corridors" in summary


def test_api_portal_endpoints():
    """
    Verifies the newly added portal ingestion endpoints via FastAPI TestClient:
    - POST /api/portal/mosdac/ingest
    - POST /api/portal/vedas/ingest
    - GET /api/portal/vedas/agri-stress
    """
    # 1. MOSDAC Ingestion Endpoint
    r_mosdac = client.post("/api/portal/mosdac/ingest")
    assert r_mosdac.status_code == 200
    mosdac_data = r_mosdac.json()
    assert mosdac_data["source_origin"] in ("local_sample", "seed_fallback", "live_portal")

    # 2. VEDAS Ingestion Endpoint
    r_vedas = client.post("/api/portal/vedas/ingest", params={"water_depth_m": 1.1, "rainfall_mm_hr": 16.0})
    assert r_vedas.status_code == 200
    vedas_data = r_vedas.json()
    assert vedas_data["source_origin"] in ("local_sample", "seed_fallback", "live_portal")

    # 3. VEDAS Agri-Stress Summary Endpoint
    r_agri = client.get("/api/portal/vedas/agri-stress")
    assert r_agri.status_code == 200
    agri_data = r_agri.json()
    assert "total_inundated_hectares" in agri_data
    assert "pmfby_eligible_blocks" in agri_data
