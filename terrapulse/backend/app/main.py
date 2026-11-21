import logging
import sys
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.models.state import state_store
from app.api.routes_state import router as state_router
from app.api.routes_scenario import router as scenario_router
from app.api.routes_sos import router as sos_router
from app.api.ws_live import router as ws_router

# ==============================================================================
# Structured Logging Configuration
# ==============================================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("terrapulse.main")


# ==============================================================================
# Lifespan Context Manager (Startup & Shutdown)
# ==============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """
    Validates filesystem assets, seeded GeoJSON data, and contract schemas at startup.
    """
    logger.info("=" * 60)
    logger.info("🛰️  TERRAPULSE SPACE-TO-GROUND GEOSPATIAL ENGINE INITIALIZING")
    logger.info(f"   Environment : {settings.APP_ENV}")
    logger.info(f"   Host/Port   : {settings.HOST}:{settings.PORT}")
    logger.info(f"   Rain Trigger: {settings.RAINFALL_THRESHOLD_MM_HR} mm/hr")
    logger.info("=" * 60)

    # 1. Verify seed data path
    seed_path = settings.resolve_seed_data_path()
    if seed_path.exists():
        logger.info(f"✓ Catchment seed data verified at: {seed_path}")
    else:
        logger.warning(f"⚠️ Catchment seed data not found at: {seed_path}")

    # 2. Verify contracts directory
    contracts_dir = settings.resolve_contracts_dir()
    if contracts_dir.exists():
        schemas = list(contracts_dir.glob("*.schema.json"))
        logger.info(f"✓ Contracts directory verified at: {contracts_dir} ({len(schemas)} schemas found)")
    else:
        logger.warning(f"⚠️ Contracts directory not found at: {contracts_dir}")

    # 3. Verify state store features
    features_count = len(state_store.features_collection.features) if state_store.features_collection else 0
    payload_kb = state_store.calculate_payload_kb()
    logger.info(f"✓ Loaded {features_count} initial GIS features (Payload: {payload_kb} KB / Target: <100 KB)")
    logger.info(f"✓ Tactical Mesh: LoRa {settings.LORA_FREQUENCY_MHZ} MHz | NavIC: {settings.NAVIC_ENABLED}")
    logger.info("🚀 TerraPulse Central Command API ready for ingestion & tactical dispatch.")

    yield

    logger.info("🛰️  TerraPulse Engine shutting down safely.")


# ==============================================================================
# FastAPI Application Declaration
# ==============================================================================

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description=(
        "Autonomous Space-to-Ground Geospatial Intelligence Pipeline & Offline "
        "Tactical Rescue Mesh for Flash Flood and Disaster Operations (INSAT-3DS, "
        "EOS-04/NISAR, Cartosat DEM, Bhuvan Cadastres, NavIC L5/S-band, LoRa 865 MHz)."
    ),
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ==============================================================================
# Cross-Origin Resource Sharing (CORS) Middleware
# ==============================================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Permits tactical field PWAs and Central Command dashboards
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==============================================================================
# API Routers Mount
# ==============================================================================

app.include_router(state_router)
app.include_router(scenario_router)
app.include_router(sos_router)
app.include_router(ws_router)


# ==============================================================================
# Root & Health Endpoints
# ==============================================================================

@app.get("/", summary="TerraPulse API Index", tags=["State & Telemetry"])
async def root() -> Dict[str, Any]:
    return {
        "engine": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.APP_ENV,
        "status": "OPERATIONAL",
        "docs": "/docs",
        "health": "/health",
        "state_endpoint": "/api/state",
        "catchment_basin": "Kothri Kalan / Sehore / Bhopal Basin (Madhya Pradesh)",
    }


@app.get("/api/health", summary="Health Alias", tags=["State & Telemetry"])
async def api_health() -> Dict[str, Any]:
    """Compatibility alias for /health"""
    from app.api.routes_state import health_check
    return await health_check()
