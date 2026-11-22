from collections import OrderedDict

from fastapi.testclient import TestClient

from app.main import app
from app.services import weather


def sample_reading():
    return {
        "current": {"time": "2026-11-22T07:00", "temperature_2m": 26, "wind_speed_10m": 9},
        "daily": {"time": ["2026-11-22"], "precipitation_sum": [12], "precipitation_probability_max": [75],
                  "wind_gusts_10m_max": [20], "temperature_2m_max": [28], "temperature_2m_min": [19]},
        "hourly": {"time": ["2026-11-22T08:00"], "precipitation": [None], "precipitation_probability": [20],
                   "wind_gusts_10m": [12]},
    }


def test_national_weather_covers_every_reference_location(monkeypatch):
    monkeypatch.setattr(weather, "_cache", OrderedDict())

    async def fetch(_service, params):
        assert len(params["latitude"].split(",")) == 36
        return [sample_reading() for _ in range(36)]

    monkeypatch.setattr(weather, "provider_json", fetch)
    response = TestClient(app).get("/api/weather/india")
    assert response.status_code == 200
    data = response.json()
    assert data["source"] == "Open-Meteo" and data["stale"] is False
    assert len({reading["state"] for reading in data["locations"]}) == 36
    assert all(reading["daily"]["precipitation_sum"] == 12 for reading in data["locations"])


def test_farmer_forecast_reports_stale_results_during_upstream_failure(monkeypatch):
    monkeypatch.setattr(weather, "_cache", OrderedDict())
    clock = [1000.0]
    monkeypatch.setattr(weather, "monotonic", lambda: clock[0])

    async def fetch(_service, params):
        assert params["latitude"] == 11.69
        if clock[0] > 1000:
            raise weather.WeatherUnavailable
        return sample_reading()

    monkeypatch.setattr(weather, "provider_json", fetch)
    client = TestClient(app)
    url = "/api/weather/field?lat=11.686&lng=76.13"
    initial = client.get(url).json()
    assert initial["stale"] is False and initial["hourly"][0]["precipitation"] is None
    clock[0] += weather.CACHE_SECONDS + 1
    cached = client.get(url).json()
    assert cached["stale"] is True and cached["retrieved_at"] == initial["retrieved_at"]
    clock[0] += weather.MAX_STALE_SECONDS
    assert client.get(url).status_code == 503
    assert client.get("/api/weather/field?lat=52&lng=76").status_code == 422
