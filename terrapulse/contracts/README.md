# 📐 TerraPulse Shared Data Contracts

This directory contains the authoritative JSON Schema definitions (Draft-07 compliant) governing data exchange between **TerraPulse**'s GeoAI ingestion pipeline, Central Command GIS dashboards, and the off-grid **NavIC + LoRa (865–867 MHz)** tactical mesh.

---

## 📑 Contract Specifications

| Schema File | Purpose | Payload Target | Key Protocols / Missions |
|:---|:---|:---:|:---|
| **[`geojson_feature.schema.json`](./geojson_feature.schema.json)** | Multi-portal GeoAI FeatureCollection responses across all 5 spatial layers | `<100 KB` | MOSDAC (INSAT-3DS), Bhoonidhi (EOS-04/NISAR), VEDAS (DEM), Bhuvan |
| **[`sos_packet.schema.json`](./sos_packet.schema.json)** | Ultra-compact citizen/responder distress beacons captured in cellular dead-zones | `<128 Bytes` | Indigenous NavIC (L5 + S-band) passive fix + Sub-GHz LoRa P2P mesh |
| **[`dispatch_vector.schema.json`](./dispatch_vector.schema.json)** | Lightweight dry evacuation corridors pushed from Command to field rescue units | `<48 KB` | NavIC SMS Broadcast / LoRa multi-hop radio |

---

## 🗺️ The Five Geospatial Layers

Each GeoJSON `Feature` within `geojson_feature.schema.json` belongs to one of the five core intelligence layers:

1. **`mosdac_rain`**: Convective precipitation nowcasting from SAC Ahmedabad (INSAT-3DS TIR1 / GSMaP 0.1°). When `rainfall_mm_hr >= 15.0`, an automated SAR acquisition alert is triggered.
2. **`bhoonidhi_flood`**: Cloud-penetrating all-weather microwave radar from NRSC Hyderabad (EOS-04 C-band & NISAR S/L-band). Delineates standing water extent polygons via radar backscatter thresholding (`< -16.5 dB`).
3. **`vedas_roads`**: Road network accessibility derived from Cartosat DEM hydrological runoff routing. Classifies roads as `OPEN` or `SUBMERGED` based on modeled water depths.
4. **`vedas_corridors`**: High-elevation ridge evacuation corridors (`road_status: "CORRIDOR"`) verified above flood crest elevation.
5. **`bhuvan_assets`**: Critical infrastructure points from NRSC Bhuvan cadastres (Hospitals, Relief Shelters, Gram Panchayats, Schools, and Reservoirs).

---

## 🛠️ How Services Validate Against Contracts

### 1. Python Services (Backend / GeoAI Pipeline)
Using the standard `jsonschema` library:

```python
import json
import jsonschema

# Load contract
with open("contracts/geojson_feature.schema.json", "r") as f:
    geojson_schema = json.load(f)

# Validate payload
def validate_geojson_response(payload: dict):
    jsonschema.validate(instance=payload, schema=geojson_schema)
```

Or via Pydantic model validation:
```python
from pydantic import BaseModel, Field
# Models in backend/app/models/schemas.py mirror these contract fields
```

### 2. TypeScript / Frontend (PWA & Command Center)
Using `ajv`:

```typescript
import Ajv from "ajv";
import geojsonSchema from "./contracts/geojson_feature.schema.json";
import sosSchema from "./contracts/sos_packet.schema.json";

const ajv = new Ajv({ allErrors: true });
const validateGeojson = ajv.compile(geojsonSchema);
const validateSos = ajv.compile(sosSchema);

export function verifySosBeacon(packet: unknown): boolean {
  const isValid = validateSos(packet);
  if (!isValid) console.error("SOS schema violations:", validateSos.errors);
  return !!isValid;
}
```

---

## 📦 Tactical Mesh Payload Budget
- **LoRa Band**: 865–867 MHz (License-free India ISM band)
- **Spreading Factor**: SF7–SF10, Bandwidth: 125 kHz
- **Hard Constraints**:
  - `sos_packet`: strictly `< 128 bytes` per beacon hop.
  - `dispatch_vector`: strictly `<= 48 KB` (compressed GeoJSON coordinates) so that tactical field units can render safe evacuation paths without needing broadband internet or cellular data.
