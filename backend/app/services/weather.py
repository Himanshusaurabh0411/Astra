import asyncio
from collections import OrderedDict
from datetime import date, datetime, timezone
from time import monotonic
from typing import Any

import httpx
from pydantic import BaseModel, ConfigDict, ValidationError

from app.config import settings
from app.models.regions import contains

PROVIDER = "Open-Meteo"
IST = "Asia/Kolkata"
CACHE_SECONDS = 15 * 60
MAX_STALE_SECONDS = 6 * 60 * 60
_cache: OrderedDict[tuple, tuple[float, dict]] = OrderedDict()
_upstream_slots = asyncio.Semaphore(4)

# One reference location for each state and union territory.
REFERENCE_LOCATIONS = (
    ("Andaman and Nicobar Islands", "Sri Vijaya Puram", 11.67, 92.74),
    ("Andhra Pradesh", "Amaravati", 16.57, 80.36),
    ("Arunachal Pradesh", "Itanagar", 27.09, 93.61),
    ("Assam", "Guwahati", 26.14, 91.74),
    ("Bihar", "Patna", 25.61, 85.14),
    ("Chandigarh", "Chandigarh", 30.73, 76.78),
    ("Chhattisgarh", "Raipur", 21.25, 81.63),
    ("Dadra and Nagar Haveli and Daman and Diu", "Daman", 20.40, 72.83),
    ("Delhi", "New Delhi", 28.61, 77.21),
    ("Goa", "Panaji", 15.49, 73.83),
    ("Gujarat", "Gandhinagar", 23.22, 72.64),
    ("Haryana", "Karnal", 29.69, 76.99),
    ("Himachal Pradesh", "Shimla", 31.10, 77.17),
    ("Jammu and Kashmir", "Srinagar", 34.08, 74.80),
    ("Jharkhand", "Ranchi", 23.34, 85.31),
    ("Karnataka", "Bengaluru", 12.97, 77.59),
    ("Kerala", "Thiruvananthapuram", 8.52, 76.94),
    ("Ladakh", "Leh", 34.15, 77.58),
    ("Lakshadweep", "Kavaratti", 10.56, 72.64),
    ("Madhya Pradesh", "Bhopal", 23.26, 77.41),
    ("Maharashtra", "Mumbai", 19.08, 72.88),
    ("Manipur", "Imphal", 24.82, 93.94),
    ("Meghalaya", "Shillong", 25.57, 91.88),
    ("Mizoram", "Aizawl", 23.73, 92.72),
    ("Nagaland", "Kohima", 25.67, 94.11),
    ("Odisha", "Bhubaneswar", 20.30, 85.82),
    ("Puducherry", "Puducherry", 11.94, 79.81),
    ("Punjab", "Ludhiana", 30.90, 75.86),
    ("Rajasthan", "Jaipur", 26.91, 75.79),
    ("Sikkim", "Gangtok", 27.34, 88.61),
    ("Tamil Nadu", "Chennai", 13.08, 80.27),
    ("Telangana", "Hyderabad", 17.39, 78.49),
    ("Tripura", "Agartala", 23.83, 91.28),
    ("Uttar Pradesh", "Lucknow", 26.85, 80.95),
    ("Uttarakhand", "Dehradun", 30.32, 78.03),
    ("West Bengal", "Kolkata", 22.57, 88.36),
)


class WeatherUnavailable(Exception):
    pass


class CurrentWeather(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    time: datetime
    temperature_2m: float | None
    wind_speed_10m: float | None


class HourlyWeather(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    time: datetime
    precipitation: float | None
    precipitation_probability: int | None
    wind_gusts_10m: float | None


class DailyWeather(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)

    time: date
    precipitation_sum: float | None
    precipitation_probability_max: int | None
    wind_gusts_10m_max: float | None
    temperature_2m_max: float | None = None
    temperature_2m_min: float | None = None


CURRENT_FIELDS = "temperature_2m,wind_speed_10m"
HOURLY_FIELDS = "precipitation,precipitation_probability,wind_gusts_10m"
DAILY_FIELDS = "precipitation_sum,precipitation_probability_max,wind_gusts_10m_max"


async def provider_json(service: str, params: dict) -> Any:
    key = settings.OPEN_METEO_API_KEY.get_secret_value() if settings.OPEN_METEO_API_KEY else ""
    host, path = ("geocoding-api", "search") if service == "geocoding" else ("api", "forecast")
    if key:
        host = f"customer-{host}"
        params = {**params, "apikey": key}
    try:
        async with _upstream_slots, httpx.AsyncClient(timeout=6.0) as client:
            response = await client.get(f"https://{host}.open-meteo.com/v1/{path}", params=params)
            response.raise_for_status()
            return response.json()
    except (httpx.HTTPError, ValueError):
        raise WeatherUnavailable from None


def unpack(columns: dict, fields: str, record_type: type[BaseModel]) -> list[dict]:
    keys = ["time", *fields.split(",")]
    return [record_type.model_validate(dict(zip(keys, values))).model_dump(mode="json")
            for values in zip(*(columns[key] for key in keys), strict=True)]


def current_reading(payload: dict) -> dict:
    return CurrentWeather.model_validate(payload["current"]).model_dump(mode="json")


async def cached_weather(key: tuple, load) -> dict:
    entry = _cache.get(key)
    if entry and monotonic() - entry[0] < CACHE_SECONDS:
        _cache.move_to_end(key)
        return {**entry[1], "stale": False}
    try:
        data = await load()
    except (WeatherUnavailable, ValidationError, ValueError, KeyError, TypeError, IndexError):
        if entry and monotonic() - entry[0] <= MAX_STALE_SECONDS:
            return {**entry[1], "stale": True}
        raise WeatherUnavailable from None
    result = {**data, "source": PROVIDER, "retrieved_at": datetime.now(timezone.utc).isoformat(), "timezone": IST}
    _cache[key] = (monotonic(), result)
    _cache.move_to_end(key)
    if len(_cache) > 256:
        _cache.popitem(last=False)
    return {**result, "stale": False}


async def forecast(lat: float, lng: float) -> dict:
    lat, lng = round(lat, 2), round(lng, 2)
    daily_fields = DAILY_FIELDS + ",temperature_2m_max,temperature_2m_min"

    async def load() -> dict:
        payload = await provider_json("forecast", {
            "latitude": lat, "longitude": lng, "timezone": IST, "forecast_days": 5,
            "current": CURRENT_FIELDS, "hourly": HOURLY_FIELDS, "daily": daily_fields,
        })
        hours = unpack(payload["hourly"], HOURLY_FIELDS, HourlyWeather)
        days = unpack(payload["daily"], daily_fields, DailyWeather)
        if not hours or not days:
            raise WeatherUnavailable
        return {"current": current_reading(payload), "hourly": hours, "daily": days}

    return await cached_weather(("forecast", lat, lng), load)


async def national_weather() -> dict:
    async def load() -> dict:
        readings = await provider_json("forecast", {
            "latitude": ",".join(str(lat) for _, _, lat, _ in REFERENCE_LOCATIONS),
            "longitude": ",".join(str(lng) for _, _, _, lng in REFERENCE_LOCATIONS),
            "timezone": IST, "forecast_days": 1, "current": CURRENT_FIELDS, "daily": DAILY_FIELDS,
        })
        if not isinstance(readings, list) or len(readings) != len(REFERENCE_LOCATIONS):
            raise WeatherUnavailable
        locations = []
        for (state, name, lat, lng), reading in zip(REFERENCE_LOCATIONS, readings, strict=True):
            locations.append({"state": state, "name": name, "lat": lat, "lng": lng,
                              "current": current_reading(reading),
                              "daily": unpack(reading["daily"], DAILY_FIELDS, DailyWeather)[0]})
        return {"locations": locations}

    return await cached_weather(("national",), load)


async def find_places(query: str) -> list[dict]:
    payload = await provider_json("geocoding", {"name": query, "count": 8, "countryCode": "IN", "language": "en"})
    return [{"name": match["name"], "state": match.get("admin1", "India"),
             "lat": match["latitude"], "lng": match["longitude"]}
            for match in payload.get("results", [])
            if match.get("country_code") == "IN" and contains(settings.india_bbox, (match["longitude"], match["latitude"]))]
