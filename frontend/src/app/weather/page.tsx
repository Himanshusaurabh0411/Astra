"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, CloudRain, CloudSun, MapPin, RefreshCw, Search, Wind } from "lucide-react";
import WorkspaceFrame from "@/components/WorkspaceFrame";
import { displayWeather, type IndiaWeather, IMD_WARNINGS } from "@/lib/weather";
import { updateTime, workspaceErrorMessage, workspaceRequest } from "@/lib/workspaceApi";

const forecastDate = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium" });

export default function IndiaWeatherPage() {
  const [weather, setWeather] = useState<IndiaWeather>();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("rain");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setError("");
    void workspaceRequest<IndiaWeather>("/api/weather/india", { signal: controller.signal })
      .then(setWeather)
      .catch((reason) => {
        if (!controller.signal.aborted) setError(workspaceErrorMessage(reason, "India weather could not load. Check your connection and try again."));
      });
    return () => controller.abort();
  }, [retry]);

  const locations = useMemo(() => {
    const match = query.trim().toLowerCase();
    return (weather?.locations ?? []).filter((entry) => `${entry.name} ${entry.state}`.toLowerCase().includes(match))
      .sort((left, right) => sort === "rain"
        ? (right.daily.precipitation_sum ?? -1) - (left.daily.precipitation_sum ?? -1)
        : left.state.localeCompare(right.state));
  }, [query, sort, weather]);

  const date = weather?.locations[0]?.daily.time;
  return <WorkspaceFrame active="weather">
    <header className="tp-workspace-heading">
      <div className="tp-workspace-eyebrow"><CloudSun size={18} /> India-wide forecast</div>
      <h1>India Weather</h1>
      <p>Compare current temperatures, rainfall forecasts and wind at one reference location in each state and union territory.</p>
      <a className="tp-button" href={IMD_WARNINGS} target="_blank" rel="noreferrer">Official IMD warnings <ArrowUpRight size={15} /></a>
    </header>
    {!weather && !error && <div className="tp-card tp-workspace-message" role="status">Loading forecasts for 36 locations…</div>}
    {error && <div className="tp-card tp-workspace-message" role="alert"><p>{error}</p>
      <button className="tp-button" type="button" onClick={() => setRetry(retry + 1)}><RefreshCw size={16} /> Try again</button></div>}
    {weather && <section className="tp-card tp-weather-panel" aria-labelledby="weather-locations">
      <div className="tp-workspace-panel-head">
        <div><h2 id="weather-locations">State &amp; territory forecasts</h2>
          <p>{weather.locations.length} reference locations{date && ` · Forecast for ${forecastDate.format(new Date(`${date}T00:00:00+05:30`))}`}</p></div>
        <div className="tp-weather-controls">
          <label className="tp-workspace-input tp-input-icon"><Search size={16} /><input type="search" aria-label="Filter states or cities"
            placeholder="Find a state or city" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
          <select className="tp-workspace-input" aria-label="Sort weather forecasts" value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="rain">Most rain first</option><option value="state">State A–Z</option>
          </select>
        </div>
      </div>
      {weather.stale && <p className="tp-workspace-cached" role="status">Using the last available forecast. The provider could not refresh it.</p>}
      <div className="tp-weather-table-wrap" tabIndex={0} role="region" aria-label="State and territory weather table">
        <table className="tp-weather-table">
          <thead><tr><th scope="col"><span><MapPin size={15} /> Reference location</span></th><th scope="col">Temperature</th>
            <th scope="col"><span><CloudRain size={15} /> Forecast rain</span></th><th scope="col">Rain chance</th>
            <th scope="col"><span><Wind size={15} /> Max. gust</span></th></tr></thead>
          <tbody>{locations.map(({ name, state, lat, lng, current, daily }) => <tr key={state}>
            <th scope="row"><a href={`/farm?${new URLSearchParams({ name, state, lat: String(lat), lng: String(lng) })}`}>
              <strong>{state}</strong><small>{name} <ArrowUpRight size={12} /></small>
            </a></th>
            <td>{displayWeather(current.temperature_2m, " °C")}</td>
            <td className={(daily.precipitation_sum ?? 0) >= 10 ? "tp-rain-amount" : undefined}>{displayWeather(daily.precipitation_sum, " mm")}</td>
            <td>{displayWeather(daily.precipitation_probability_max, "%")}</td>
            <td>{displayWeather(daily.wind_gusts_10m_max, " km/h")}</td>
          </tr>)}</tbody>
        </table>
        {!locations.length && <p className="tp-workspace-message">No matching location.</p>}
      </div>
      <p className="tp-weather-source">Weather model data by <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">{weather.source}</a>.
        {` Fetched ${updateTime(weather.retrieved_at)} IST.`}</p>
    </section>}
  </WorkspaceFrame>;
}
