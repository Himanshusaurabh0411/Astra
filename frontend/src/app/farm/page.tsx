"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowUpRight, CalendarDays, CloudRain, Crosshair, Droplets, MapPin, RefreshCw, Search, Sprout, Sun, Wheat, Wind,
} from "lucide-react";
import WorkspaceFrame from "@/components/WorkspaceFrame";
import { getRegion, INDIA, INDIA_REGIONS, inBounds } from "@/lib/regions";
import { displayWeather, fieldWindow, type FieldForecast, IMD_AGROMET, upcomingHours, type WeatherPlace } from "@/lib/weather";
import { updateTime, workspaceErrorMessage, workspaceRequest } from "@/lib/workspaceApi";

const PRESETS = INDIA_REGIONS.flatMap((region) => region.places.map((place) => ({
  name: place.name, state: place.state, lng: place.center[0], lat: place.center[1],
})));
const days = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
const times = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });

function startingPlace(): WeatherPlace {
  const params = new URLSearchParams(window.location.search);
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  if (inBounds([lng, lat], INDIA.bbox)) {
    return { name: params.get("name")?.slice(0, 80) || "Selected field", state: params.get("state")?.slice(0, 80) || "India", lat, lng };
  }
  const place = getRegion(params.get("region") ?? undefined).places[0];
  return PRESETS.find(({ name }) => name === place?.name) ?? PRESETS[0];
}

function windowText(window: NonNullable<ReturnType<typeof fieldWindow>>) {
  return `${days.format(window.start)} · ${times.format(window.start)} – ${times.format(window.end)}`;
}

function FieldPlan({ forecast, now }: { forecast: FieldForecast; now: number }) {
  const hours = upcomingHours(forecast, now, 48);
  const tomorrow = upcomingHours(forecast, now, 24);
  const rainTimes = tomorrow.map(({ precipitation }) => precipitation);
  const knownRain = rainTimes.length >= 22 && rainTimes.every((amount) => amount !== null);
  const totalRain = knownRain ? rainTimes.reduce<number>((sum, value) => sum + (value ?? 0), 0) : null;
  const chances = tomorrow.flatMap(({ precipitation_probability }) => precipitation_probability === null ? [] : [precipitation_probability]);
  const rainy = totalRain !== null && totalRain >= 5 && Math.max(...chances) >= 60;
  const spray = fieldWindow(hours, 2, 18);
  const harvest = fieldWindow(hours, 3, 32);
  return <section aria-labelledby="farm-work-heading" className="tp-farm-plan">
    <div className="tp-workspace-section-head"><div><h2 id="farm-work-heading">Plan your next 48 hours</h2>
      <p>Suggested times use local rain and wind forecasts. All times are in IST.</p></div><CalendarDays size={25} aria-hidden="true" /></div>
    <div className="tp-farm-advice-grid">
      <article className="tp-card tp-farm-advice">
        <span className="tp-workspace-icon tp-tone-water"><Droplets size={22} /></span>
        <h3>Irrigation</h3>
        <strong>{rainy ? "Check the field after rain" : "Check soil before watering"}</strong>
        <p>{totalRain === null ? "Rain totals are unavailable for the next 24 hours. Check soil moisture and local advice."
          : `${displayWeather(totalRain, " mm")} of rain forecast in the next 24 hours. ${rainy
            ? "Check soil moisture after it rains before irrigating."
            : "Check moisture at the roots before deciding whether to irrigate."}`}</p>
      </article>
      <article className="tp-card tp-farm-advice">
        <span className="tp-workspace-icon tp-tone-green"><Wind size={22} /></span>
        <h3>Spraying</h3>
        <strong>{spray ? windowText(spray) : "No dry, calm two-hour window found"}</strong>
        {spray && <small>{spray.rain}% max rain chance · {displayWeather(spray.gust, " km/h")} max gust</small>}
        <p>Check the product label, local advisories and conditions at the field before you spray.</p>
      </article>
      <article className="tp-card tp-farm-advice">
        <span className="tp-workspace-icon tp-tone-sun"><Wheat size={22} /></span>
        <h3>Harvest &amp; drying</h3>
        <strong>{harvest ? windowText(harvest) : "No dry three-hour window found"}</strong>
        {harvest && <small>{harvest.rain}% max rain chance · {displayWeather(harvest.gust, " km/h")} max gust</small>}
        <p>{harvest ? "Use this window to plan work if the crop is ready. Check field access before moving equipment."
          : "Keep harvested produce under cover and check the next forecast before drying outdoors."}</p>
      </article>
    </div>
  </section>;
}

export default function FarmPlannerPage() {
  const [place, setPlace] = useState<WeatherPlace>();
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<WeatherPlace[]>([]);
  const [forecast, setForecast] = useState<FieldForecast>();
  const [forecastError, setForecastError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [retry, setRetry] = useState(0);
  const [now, setNow] = useState(0);

  useEffect(() => {
    const selected = startingPlace();
    setPlace(selected);
    setQuery(selected.name);
    setNow(Date.now());
    const ticker = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (!place) return;
    const controller = new AbortController();
    setForecastError("");
    const params = new URLSearchParams({ lat: place.lat.toFixed(2), lng: place.lng.toFixed(2) });
    void workspaceRequest<FieldForecast>(`/api/weather/field?${params}`, { signal: controller.signal })
      .then((value) => { if (!controller.signal.aborted) setForecast(value); })
      .catch((error) => {
        if (!controller.signal.aborted) setForecastError(workspaceErrorMessage(error, "Could not load the forecast. Check your connection and try again."));
      });
    return () => controller.abort();
  }, [place, retry]);

  const choose = (selection: WeatherPlace) => {
    setPlace({ ...selection });
    setForecast(undefined);
    setNow(Date.now());
    setForecastError("");
    setQuery(selection.name);
    setPlaces([]);
    setLocationMessage("");
  };

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = query.trim();
    if (text.length < 2 || searching) return;
    const local = PRESETS.filter(({ name, state }) => `${name}, ${state}`.toLowerCase().includes(text.toLowerCase()));
    setLocationMessage("");
    if (local.length === 1) return choose(local[0]);
    if (local.length) return setPlaces(local);
    setPlaces([]);
    setSearching(true);
    try {
      const found = await workspaceRequest<WeatherPlace[]>(`/api/weather/places?${new URLSearchParams({ q: text })}`);
      if (found.length === 1) choose(found[0]);
      else setPlaces(found);
      if (!found.length) setLocationMessage("No place found. Try a nearby town or PIN code.");
    } catch (error) {
      setLocationMessage(workspaceErrorMessage(error, "Place search is unavailable. Choose a nearby preset or use your location."));
    } finally {
      setSearching(false);
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setLocationMessage("Device location is unavailable. Search for your village or choose a nearby place.");
      return;
    }
    setLocating(true);
    setLocationMessage("");
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setLocating(false);
      const lat = Number(coords.latitude.toFixed(2));
      const lng = Number(coords.longitude.toFixed(2));
      if (inBounds([lng, lat], INDIA.bbox)) choose({ name: "My field", state: "Device location", lat, lng });
      else setLocationMessage("Choose a field inside the India coverage area.");
    }, () => {
      setLocating(false);
      setLocationMessage("Could not get your location. Search for your village or choose a nearby place.");
    }, { timeout: 8000, maximumAge: 60_000 });
  }

  const fresh = forecast && !forecast.stale && now - Date.parse(forecast.retrieved_at) < 6 * 60 * 60 * 1000;
  return <WorkspaceFrame active="farm">
    <header className="tp-workspace-heading tp-farm-heading">
      <div className="tp-workspace-eyebrow"><Sprout size={19} /> Weather for your field</div>
      <h1>Farm Planner</h1>
      <p>Find a dry time to harvest, see when rain might handle watering, and plan around wind before spraying.</p>
      <a className="tp-button" href={IMD_AGROMET} target="_blank" rel="noreferrer">Official IMD farm advisories <ArrowUpRight size={15} /></a>
    </header>

    <div className="tp-farm-location-grid">
      <section className="tp-card tp-farm-location" aria-labelledby="farm-location-heading">
        <h2 id="farm-location-heading"><MapPin size={19} /> Choose your field</h2>
        <form className="tp-farm-search" onSubmit={(event) => void search(event)}>
          <label className="tp-workspace-input tp-input-icon"><Search size={17} /> <input type="search" aria-label="Village, town or PIN code"
            placeholder="Village, town or PIN code" value={query} minLength={2} maxLength={80} onChange={(event) => setQuery(event.target.value)} required /></label>
          <button className="tp-button tp-workspace-primary" type="submit" disabled={searching || locating}>{searching ? "Searching…" : "Search"}</button>
        </form>
        {places.length > 0 && <ul className="tp-farm-places" aria-label="Matching places">{places.map((item) => <li key={`${item.name}-${item.lat}-${item.lng}`}>
          <button type="button" onClick={() => choose(item)}><MapPin size={15} /><span><strong>{item.name}</strong><small>{item.state}</small></span></button>
        </li>)}</ul>}
        <div className="tp-farm-location-actions">
          <button type="button" className="tp-button" disabled={locating || searching} onClick={locate}><Crosshair size={17} /> {locating ? "Finding you…" : "Use my location"}</button>
          <select className="tp-workspace-input" aria-label="Nearby place presets" disabled={locating || searching}
            value={PRESETS.some((item) => item.name === place?.name) ? place?.name : ""}
            onChange={(event) => { const item = PRESETS.find(({ name }) => name === event.target.value); if (item) choose(item); }}>
            <option value="" disabled>Choose a nearby place</option>
            {PRESETS.map((item) => <option key={item.name} value={item.name}>{item.name}, {item.state}</option>)}
          </select>
        </div>
        {locationMessage && <p className="tp-workspace-inline-error" role="status">{locationMessage}</p>}
      </section>

      <section className="tp-card tp-farm-reading" aria-label="Field weather summary" aria-live="polite">
        <div className="tp-farm-reading-place"><Sun size={21} /><div><h2>{place?.name ?? "Field forecast"}</h2><p>{place?.state}</p></div></div>
        {forecast && <dl>
          <div><dt>Temperature</dt><dd>{displayWeather(forecast.current.temperature_2m, " °C")}</dd></div>
          <div><dt>Wind</dt><dd>{displayWeather(forecast.current.wind_speed_10m, " km/h")}</dd></div>
        </dl>}
        {forecastError ? <div className="tp-farm-reading-error"><p>{forecastError}</p>
          <button type="button" className="tp-button" onClick={() => setRetry(retry + 1)}><RefreshCw size={15} /> Retry</button></div>
          : forecast ? <p className="tp-farm-reading-date">{fresh ? "Forecast fetched" : "Last saved forecast"} {updateTime(forecast.retrieved_at)} IST</p>
            : <p role="status">Loading weather for your field…</p>}
      </section>
    </div>

    {forecast && fresh && <FieldPlan forecast={forecast} now={now} />}
    {forecast && !fresh && <p className="tp-workspace-cached" role="status">Showing the last available conditions. Work windows return when the forecast can refresh.</p>}
    {forecast && <section className="tp-card tp-farm-outlook" aria-labelledby="farm-outlook-heading">
      <div className="tp-workspace-panel-head"><div><h2 id="farm-outlook-heading">5-day outlook</h2><p>Forecast rain, temperature and wind by day.</p></div></div>
      <ul>{forecast.daily.map((day) => <li key={day.time}>
        <strong>{days.format(new Date(`${day.time}T00:00:00+05:30`))}</strong>
        <div className="tp-farm-outlook-rain"><CloudRain size={18} /> {displayWeather(day.precipitation_sum, " mm")}</div>
        <span>{displayWeather(day.precipitation_probability_max, "%")} rain chance</span>
        <span>{displayWeather(day.temperature_2m_min, "°")} – {displayWeather(day.temperature_2m_max, "°C")}</span>
        <span>Gusts {displayWeather(day.wind_gusts_10m_max, " km/h")}</span>
      </li>)}</ul>
      <p className="tp-weather-source">Weather model data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{forecast.source}</a>.</p>
    </section>}
  </WorkspaceFrame>;
}
