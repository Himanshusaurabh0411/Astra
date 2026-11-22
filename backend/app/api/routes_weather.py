from fastapi import APIRouter, HTTPException, Query

from app.config import settings
from app.models.regions import contains
from app.services import weather

router = APIRouter(prefix="/api/weather", tags=["India Weather"])


def unavailable() -> HTTPException:
    return HTTPException(503, "The weather provider is unavailable. Try again in a moment.")


@router.get("/field")
async def field_forecast(lat: float = Query(ge=6.5, le=37.5), lng: float = Query(ge=68, le=97.5)):
    if not contains(settings.india_bbox, (lng, lat)):
        raise HTTPException(422, "Choose a location inside the India coverage area.")
    try:
        return await weather.forecast(lat, lng)
    except weather.WeatherUnavailable:
        raise unavailable() from None


@router.get("/india")
async def india_weather():
    try:
        return await weather.national_weather()
    except weather.WeatherUnavailable:
        raise unavailable() from None


@router.get("/places")
async def places(q: str = Query(min_length=2, max_length=80)):
    if len(q.strip()) < 2:
        return []
    try:
        return await weather.find_places(q.strip())
    except (weather.WeatherUnavailable, KeyError, TypeError, AttributeError):
        raise unavailable() from None
