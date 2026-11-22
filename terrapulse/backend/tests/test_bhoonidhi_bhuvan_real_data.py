import json
from pathlib import Path
import pytest
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.models.schemas import AssetType, HazardSeverity, SpatialLayer
from app.models.state import state_store
from app.services.bhoonidhi_service import bhoonidhi_service
from app.services.bhuvan_service import bhuvan_service

client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_state_before_each():
    """Ensure state store is reset to baseline before and after each test."""
    state_store.reset_to_baseline()
    yield
    state_store.reset_to_baseline()


def test_bhoonidhi_stac_json_ingestion():
    """
    Verifies that real Bhoonidhi EOS-04 SAR flood STAC JSON parses correctly:
    - Normalizes into bhoonidhi_flood GeoJsonFeature
    - Extracts water_depth_m (1.85m) and radar backscatter threshold (-16.8 dB)
    - Verifies polygon geometry is simplified and compact (<100 KB budget)
    - Sets data_source_origin = 'local_sample'
    """
    sample_path = settings.resolve_bhoonidhi_sample_path()
    assert sample_path is not None, "Bhoonidhi sample path should resolve"
    assert sample_path.exists(), f"Bhoonidhi sample missing at {sample_path}"

    summary = bhoonidhi_service.ingest_sar_flood_data(override_path=sample_path)
    assert summary["source_origin"] == "local_sample"
    assert summary["peak_water_depth_m"] >= 1.5
    assert summary["inundation_confirmed"] is True
    assert summary["severity"] == "CRITICAL"

    # State store validation
    features = state_store.features_collection.features
    flood_features = [f for f in features if f.properties.layer == SpatialLayer.BHOONIDHI_FLOOD]
    assert len(flood_features) >= 1
    for ff in flood_features:
        assert ff.properties.data_source_origin == "local_sample"
        assert ff.properties.water_depth_m >= 1.5
        # Geometry coordinates check (simplified and rounded)
        ring = ff.geometry.coordinates[0]
        assert len(ring) <= 16
        for pt in ring:
            assert len(str(pt[0]).split(".")[-1]) <= 4

    assert state_store.features_collection.metadata.payload_kb < settings.MAX_VECTOR_PAYLOAD_KB


def test_bhoonidhi_transect_csv_ingestion():
    """
    Verifies that SAR radar backscatter transect CSV points parse into an inundation polygon envelope.
    """
    app_dir = Path(__file__).resolve().parent.parent / "app"
    csv_path = app_dir / "data" / "real_samples" / "bhoonidhi" / "sar_backscatter_transect.csv"
    assert csv_path.exists(), f"Bhoonidhi CSV transect missing at {csv_path}"

    summary = bhoonidhi_service.ingest_sar_flood_data(override_path=csv_path)
    assert summary["source_origin"] == "local_sample"
    assert summary["peak_water_depth_m"] >= 1.0

    features = state_store.features_collection.features
    flood_feat = next((f for f in features if f.properties.layer == SpatialLayer.BHOONIDHI_FLOOD), None)
    assert flood_feat is not None
    assert flood_feat.geometry.type == "Polygon"


def test_bhoonidhi_fallback():
    """
    Verifies graceful fallback when Bhoonidhi endpoint and local file fail or are missing.
    """
    summary = bhoonidhi_service.ingest_sar_flood_data(
        override_url="http://127.0.0.1:59999/unreachable_bhoonidhi",
        override_path=Path("nonexistent_sar.json"),
    )
    assert summary["source_origin"] == "seed_fallback"
    assert "peak_water_depth_m" in summary


def test_bhuvan_critical_infrastructure_ingestion():
    """
    Verifies that Bhuvan cadastral facilities GeoJSON parses correctly:
    - Ingests hospital, high-ground shelter, gram panchayat, school, checkdam
    - Confirms VIT Bhopal Auditorium is high-ground (512m AMSL) shelter with capacity 2,500
    - Sets source_origin = 'local_sample'
    """
    sample_path = settings.resolve_bhuvan_sample_path()
    assert sample_path is not None
    assert sample_path.exists()

    summary = bhuvan_service.ingest_critical_facilities(
        override_path=sample_path,
        rainfall_mm_hr=4.8,
        flood_depth_m=0.0,
    )
    assert summary["source_origin"] == "local_sample"
    assert summary["assets_evaluated"] >= 5
    assert "VIT Bhopal" in summary["primary_shelter"]

    features = state_store.features_collection.features
    asset_features = [f for f in features if f.properties.layer == SpatialLayer.BHUVAN_ASSETS]
    assert len(asset_features) >= 5

    # Check VIT Shelter properties
    shelter = next((f for f in asset_features if f.properties.asset_type == AssetType.SHELTER), None)
    assert shelter is not None
    assert shelter.properties.elevation_m >= 510.0
    assert shelter.properties.capacity == 2500
    assert shelter.properties.water_depth_m == 0.0


def test_bhuvan_emergency_multi_hazard_scoring():
    """
    Verifies dynamic multi-hazard scoring of Bhuvan facilities during flood & rain emergency:
    - CHC Hospital escalates to HIGH severity (trauma intake activated)
    - Sevan Checkdam escalates to CRITICAL severity (sluice discharge alert)
    - High-ground VIT Shelter remains LOW severity (dry ground)
    """
    sample_path = settings.resolve_bhuvan_sample_path()
    summary = bhuvan_service.ingest_critical_facilities(
        override_path=sample_path,
        rainfall_mm_hr=18.5,
        flood_depth_m=1.4,
    )
    assert summary["high_critical_assets"] >= 2

    features = state_store.features_collection.features
    hosp = next((f for f in features if f.properties.layer == SpatialLayer.BHUVAN_ASSETS and f.properties.asset_type == AssetType.HOSPITAL), None)
    assert hosp is not None
    assert hosp.properties.severity == HazardSeverity.HIGH
    assert hosp.properties.evacuation_priority == 3
    assert "EMERGENCY MEDICAL TRIAGE" in hosp.properties.recommended_action

    dam = next((f for f in features if f.properties.layer == SpatialLayer.BHUVAN_ASSETS and f.properties.asset_type == AssetType.RESERVOIR), None)
    assert dam is not None
    assert dam.properties.severity == HazardSeverity.CRITICAL
    assert dam.properties.water_depth_m > 1.0


def test_bhuvan_waterbodies_inventory():
    """
    Verifies that Bhuvan National Water Body Information System JSON parses:
    - Computes average reservoir storage
    - Identifies reservoirs with surcharge alerts (>90% full)
    """
    wb_path = settings.resolve_bhuvan_lulc_sample_path()
    assert wb_path is not None
    assert wb_path.exists()

    wbs = bhuvan_service.ingest_waterbody_inventory(override_path=wb_path)
    assert len(wbs) >= 2

    summary = bhuvan_service.get_waterbody_summary()
    assert summary["total_waterbodies_monitored"] >= 2
    assert summary["avg_storage_pct"] > 80.0
    assert any("Kerwa" in name for name in summary["surcharge_alert_reservoirs"])


def test_bhuvan_fallback():
    """
    Verifies clean fallback when Bhuvan endpoint and sample file are absent.
    """
    summary = bhuvan_service.ingest_critical_facilities(
        override_url="http://127.0.0.1:59999/unreachable_bhuvan",
        override_path=Path("nonexistent_bhuvan.geojson"),
    )
    assert summary["source_origin"] == "seed_fallback"
    assert summary["assets_evaluated"] >= 1


def test_bhoonidhi_bhuvan_api_endpoints():
    """
    Verifies the new Bhoonidhi and Bhuvan API endpoints via FastAPI TestClient:
    - POST /api/portal/bhoonidhi/ingest
    - POST /api/portal/bhuvan/ingest
    - GET /api/portal/bhuvan/waterbodies
    """
    # 1. Bhoonidhi Ingestion
    r_bhoonidhi = client.post("/api/portal/bhoonidhi/ingest", params={"rainfall_mm_hr": 18.0})
    assert r_bhoonidhi.status_code == 200
    bh_data = r_bhoonidhi.json()
    assert bh_data["source_origin"] in ("local_sample", "seed_fallback", "live_portal")

    # 2. Bhuvan Ingestion
    r_bhuvan = client.post("/api/portal/bhuvan/ingest", params={"rainfall_mm_hr": 16.0, "flood_depth_m": 1.2})
    assert r_bhuvan.status_code == 200
    bv_data = r_bhuvan.json()
    assert bv_data["source_origin"] in ("local_sample", "seed_fallback", "live_portal")

    # 3. Bhuvan Waterbodies Summary
    r_wb = client.get("/api/portal/bhuvan/waterbodies")
    assert r_wb.status_code == 200
    wb_data = r_wb.json()
    assert "total_waterbodies_monitored" in wb_data
    assert "avg_storage_pct" in wb_data
