# TerraPulse

TerraPulse is an India-wide disaster-monitoring and rescue exercise website. It brings heavy rain, flood water, road closures, relief points and requests for help together on one map. The field responder can open a previously saved map and queue an SOS while disconnected.

The bundled measurements, routes and incidents are exercise data. TerraPulse simulates NavIC positioning and LoRa/BLE radio hops. Device location uses browser geolocation when you allow it.

## Run with Docker

Install Docker with Compose, then run these commands from the repository root.

```bash
docker compose up --build -d --wait
docker compose ps
```

Open [the dashboard](http://localhost:3000) or [Field Responder](http://localhost:3000/field). [The API health page](http://localhost:8000/health) shows the current data source for each portal. The containers bind to loopback, and the frontend proxies REST and WebSocket traffic to the API. Change `TERRAPULSE_WEB_PORT` or `TERRAPULSE_API_PORT` in `.env` if a host port is in use.

To change settings, copy [`.env.example`](.env.example) to `.env` and edit the copy. Run `docker compose up --build -d --wait` again after changing the Google Maps key. Stop the stack with `docker compose down`.

## Google Maps

Enable the Maps JavaScript API and billing in Google Cloud. Create a browser key, restrict it to the Maps JavaScript API and the site's HTTP referrer, and set `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` in `.env`. For local use, add `http://localhost:3000/*` to the allowed referrers. [Google Maps setup](https://developers.google.com/maps/documentation/javascript/get-api-key)

**Satellite**, **Hybrid** and **Map** use Google Maps when available. The app switches to its bundled terrain and vector map when the key is absent, Google Maps fails to load, the browser goes offline or the network blackout exercise is active. The cube control tilts the bundled map while keeping incident markers and routes aligned. Place search includes the seven basin presets, cities and state capitals, aliases, and current map alerts. A working Google Maps key enables wider place search when connected. If you open `127.0.0.1:3000`, add `http://127.0.0.1:3000/*` to the key's allowed referrers too.

The bundled background uses [NASA Blue Marble](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-topography-bathymetry/). The vector map uses [Natural Earth, India viewpoint](https://www.naturalearthdata.com/downloads/10m-cultural-vectors/).

## India Weather and Farm Planner

[India Weather](http://localhost:3000/weather) shows current model conditions and daily forecasts at 36 reference locations, one for each state and union territory. Select a location to open [Farm Planner](http://localhost:3000/farm). Search by village, town or PIN code, use a preset such as Wayanad, or use browser location with permission. Farm Planner shows the next five days and uses rain chances and wind gusts to find possible work windows over the next 48 hours. It rounds field coordinates to two decimal places before requesting a forecast.

The backend uses Open-Meteo and marks cached forecasts when a refresh fails. The public endpoint suits a non-commercial demo. Set server-side `OPEN_METEO_API_KEY` to use a paid endpoint. IMD links on both pages open the official district warnings and crop advisories. Disaster layers still use the source status shown in Settings. [Open-Meteo documentation](https://open-meteo.com/en/docs) · [IMD district warnings](https://mausam.imd.gov.in/responsive/districtWiseWarningGIS.php)

## Government Portal

The [Government Portal](http://localhost:3000/government) accepts accounts provisioned by a TerraPulse administrator. Signed-in officers can read exercise SOS notes, mark requests resolved, and review the four disaster data sources. Public SOS responses omit the notes.

From `backend/`, generate a password hash for each officer account.

```bash
python -m app.services.government_auth --email officer@example.gov.in --agency "District Emergency Operations"
```

Add the generated `GOVERNMENT_ACCOUNTS` line to the root `.env` and restart the backend. Combine the JSON records into a single array for multiple accounts. Use verified work emails when provisioning real staff. Set `APP_ENV=production`, serve over HTTPS, and include the frontend URL in `CORS_ORIGINS` for a hosted installation. Sessions and the exercise response queue are held by the running API process and reset when it restarts.

## Three-minute demo

1. **0:00–0:45 | Find a place.** Start on **All India**. Search for **Darbhanga**, **Bhopal** or **Wayanad**, or use **Region / Basin**. Select a map marker and open **Details**, **Impact** and **Resources**. Change the map view and turn a data layer off and on.
2. **0:45–1:35 | Simulate heavy rain.** Select **Northeast India**, then **Simulate Heavy Rain**. The rain and water readings rise, a low road closes, and a higher-ground route remains available. Select **Send Safe Route** to share the route with the Field Responder.
3. **1:35–2:35 | Run the blackout.** Select **Simulate Network Blackout** and open **Field Responder** in a second tab. Choose an Indian location, set urgency and headcount, and send a help request. It stays in the device queue during the blackout. To demonstrate a browser disconnect, let the field page load once, then use the browser’s offline setting and reload it.
4. **2:35–3:00 | Restore and review.** Restore the browser connection, then select **Restore Connection** on the dashboard. The queued request syncs and appears under **Disaster Alerts**. Use **Reset** to return to the starting exercise.

## Connect data feeds

The map accepts WGS84 bounds from **68.0°E to 97.5°E** and **6.5°N to 37.5°N**. Each region includes labelled example locations and features from four data sources.

| Portal | Data accepted |
| --- | --- |
| [MOSDAC](https://www.mosdac.gov.in/) | INSAT-3D/3DR/3DS and GSMaP hourly rain, wind and soil moisture in JSON, GeoJSON, CSV or a geolocated weather feed |
| [Bhoonidhi](https://bhoonidhi.nrsc.gov.in/) | Processed NISAR, EOS-04, Sentinel or Landsat water observations in STAC Item/ItemCollection, GeoJSON or CSV. Optional calibrated SAR GeoTIFF |
| [VEDAS](https://vedas.sac.gov.in/en/) | Cartosat road and elevation profiles, passability, crop stress and drought readings. Optional DEM GeoTIFF |
| [Bhuvan](https://bhuvan.nrsc.gov.in/) | GeoJSON or WFS features for public facilities, water bodies, land use and local boundaries |

Set the corresponding URL and optional bearer token in `.env`. Use a machine-readable export or an endpoint your account can access. Open **Settings** and select **Refresh data**, or call `POST /api/ingest/sync`. Each reader tries the configured feed, then local files, then its built-in seed. Each source reports its type, record count and sync time. For custom Docker sample paths, mount the directory read-only and set the path to its location inside the backend container. [Supported file formats and sample data](backend/app/data/real_samples/README.md)

## Local development

Use Python 3.11+ and Node.js 22. Open two terminals from the project root.

```bash
cd backend
python -m pip install -r requirements.txt
python -m uvicorn app.main:app --reload
```

```bash
cd frontend
npm ci
npm run dev
```

Open [TerraPulse](http://localhost:3000). Use localhost or HTTPS for installable PWA features. The service worker prepares the dashboard and field page after an online visit. The browser stores the map, routes and queued exercise requests in IndexedDB. Queued requests sync when the field page reconnects or through Background Sync where the browser supports it. The demo API keeps shared exercise state in memory and restores fixtures on restart or reset.

## API and checks

| Request | Purpose |
| --- | --- |
| `GET /health` | Read API, portal and mesh status |
| `GET /api/regions` | Read basins, map centers, zoom and activity counts |
| `GET /api/state?region=northeast-india&bbox=90,24,96,28` | Read a region or area. You can use either filter independently |
| `POST /api/ingest/sync` | Refresh all portal sources |
| `POST /api/scenario/rainfall-spike` | Simulate rain with an optional region, rainfall rate or multiplier |
| `POST /api/mode` | Set `NORMAL`, `CELL_BLACKOUT_MESH_ACTIVE` or `BACKHAUL_SYNC` |
| `POST /api/sos` | Submit a single help packet or a batch of up to 50 |
| `POST /api/dispatch` | Share a route for a region or a supplied corridor |
| `POST /api/reset` | Reset the exercise |
| `WS /ws/live` | Receive state, SOS and route events |

GeoJSON responses stay below 100 KB. In a dense feed, regional and bounding-box queries can retrieve features omitted from the national snapshot. [Data contracts](contracts/README.md)

```bash
cd backend
python -m pytest
cd ../frontend
npx tsc --noEmit
npm run build
```

Use `npm run audit` at the repository root for the source and configuration checks.
