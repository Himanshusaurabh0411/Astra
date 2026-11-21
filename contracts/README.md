# TerraPulse data contracts

The FastAPI API emits compact JSON using WGS84 coordinates in `[longitude, latitude]` order. The dashboard and field responder use the same structures.

| File | Used for |
| --- | --- |
| [`india-regions.json`](india-regions.json) | Shared region directory, with map centers, zoom, bounding boxes and searchable places |
| [`geojson_feature.schema.json`](geojson_feature.schema.json) | Rain, flood, road, route and facility features from `GET /api/state` |
| [`sos_packet.schema.json`](sos_packet.schema.json) | Single and batched help requests. `sos_id` makes a retry idempotent |
| [`dispatch_vector.schema.json`](dispatch_vector.schema.json) | Compact route and relief point from `POST /api/dispatch` |

`/api/state` accepts a region ID and/or `bbox=west,south,east,north`. Features intersect the supplied bounding box using their geometry extents. Pins use their coordinates. GeoJSON includes a `payload_kb` reading in decimal kilobytes and has a strict limit of 100,000 serialized bytes under the default settings. Regional reads can recover data omitted from a dense national snapshot marked `truncated`. Dispatches keep the stricter existing 48 KB budget.

In `features.metadata.portal_provenance`, each portal lists `source_type` (`live_portal`, `local_sample` or `seed_fallback`), `records_ingested` and `last_synced_at`. Individual features can identify a simulated change using `data_source_origin: "simulation_spike"`.

`/ws/live` sends `{ "event": ..., "timestamp": ..., "data": ... }`. The dashboard refreshes its state for `state_updated`, `sos_received` and `dispatch_pushed`. An SOS event contains the packet ID. Clients reconnect and poll state if the stream drops.
