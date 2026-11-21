# TerraPulse portal samples

Bundled files represent an exercise using portal-style records. The coordinates identify real regions and approximate landmarks. Flood extents, facility status, shelters, routes, reservoir levels and measurements are exercise data.

| Folder | National exercise file | Additional examples |
| --- | --- | --- |
| `mosdac` | `pan_india_rain.geojson` | INSAT hourly JSON and GSMaP rainfall CSV |
| `bhoonidhi` | `pan_india_water.geojson` | EOS-04 STAC Item and radar transect CSV |
| `vedas` | `pan_india_land_and_roads.geojson` | Cartosat road profiles and crop phenology JSON |
| `bhuvan` | `pan_india_places_and_water.geojson` | Critical facilities GeoJSON and water-body inventory JSON |

The feature collection used before a sync is [`seed_catchment.geojson`](../seed_catchment.geojson). It covers Central India, the Indo-Gangetic floodplain, Northeast India, the east coast, the Western Ghats, the Himalayan zone and the arid belt. [The shared region catalogue](../../../../contracts/india-regions.json) lists the bounds, center, places and search aliases.

## Export formats

- **MOSDAC** accepts JSON records and GeoJSON features with `rainfall_rate_mm_hr` or `rainfall_mm_hr`, a location, and optional `wind_km_hr` and `soil_moisture_pct`. CSV can use `lat` and `lng`. RSS/Atom items need a rain value and coordinates or a GeoRSS point.
- **Bhoonidhi** accepts STAC Items or GeoJSON with water polygons and `water_depth_m`, `peak_water_depth_m` or `water_detected`. Transect CSV uses `lat`, `lng`, `backscatter_db` and `estimated_water_depth_m`. A STAC image footprint alone will not produce a flood observation.
- **VEDAS** accepts road profiles with line geometry, elevation and optional `clearance_m`, `slope_pct` and `road_status`. CSV can use `start_lng,start_lat,end_lng,end_lat`. Normalized GeoJSON can include crop observations using `record_kind: "crop_stress"` and `crop_stress_pct`.
- **Bhuvan** accepts WGS84 WFS GeoJSON or GML features with facility type and geometry. Use `asset_type` values from the contract. Water and land records can supply `storage_pct`, `capacity_mcm`, `land_use` and `boundary_type`. WFS GeoJSON is preferred for interoperable longitude/latitude ordering.
- **GeoTIFF** is optional. Install `rasterio` and `numpy` to turn a single-band calibrated SAR dB mask into water polygons and to sample a Cartosat DEM along known routes. The SAR mask shows where water may be present. Depth requires a calibrated depth observation. Routes require existing line geometry. `shapely` can improve polygon simplification when installed.
- **Normalized exports** may use the [GeoJSON contract](../../../../contracts/geojson_feature.schema.json). Keep observations in WGS84 and include `observed_at` when known. Use the coordinate order `[longitude, latitude]`.

Configure a read-only machine endpoint instead of a portal login page. Invalid responses, authentication errors, oversized exports and missing optional raster libraries fall back to available samples. Map metadata identifies that source.
