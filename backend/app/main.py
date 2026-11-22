import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.routes_government import router as government_router
from app.api.routes_scenario import router as scenario_router
from app.api.routes_sos import router as sos_router
from app.api.routes_state import health_check, router as state_router
from app.api.routes_weather import router as weather_router
from app.api.ws_live import router as ws_router
from app.config import settings

logger = logging.getLogger("terrapulse")

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="India disaster-monitoring and field rescue exercise API.",
    docs_url="/docs" if settings.APP_ENV != "production" else None,
    redoc_url=None,
    openapi_url="/openapi.json" if settings.APP_ENV != "production" else None,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[url.strip() for url in settings.CORS_ORIGINS.split(",") if url.strip()],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.middleware("http")
async def response_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    if request.url.scheme == "https":
        response.headers["Strict-Transport-Security"] = "max-age=31536000"
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"detail": [
            {"loc": error["loc"], "msg": error["msg"], "type": error["type"]}
            for error in exc.errors()
        ]},
    )


app.include_router(state_router)
app.include_router(scenario_router)
app.include_router(sos_router)
app.include_router(government_router)
app.include_router(weather_router)
app.include_router(ws_router)


@app.get("/")
async def root():
    return {
        "engine": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.APP_ENV,
        "status": "OPERATIONAL",
        "health": "/health",
        "state_endpoint": "/api/state",
        "catchment_basin": "All India, including Kothri Kalan and the Narmada–Betwa Basin",
    }


@app.get("/api/health")
async def api_health():
    return await health_check()
