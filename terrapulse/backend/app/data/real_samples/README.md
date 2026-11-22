# TerraPulse Real-World Portal Samples: MOSDAC, VEDAS, Bhoonidhi & Bhuvan

This directory holds realistic sample files and schemas exported from ISRO's 4 authoritative earth observation and GIS portals:
1. **MOSDAC** (Meteorological and Oceanographic Satellite Data Archival Centre, SAC Ahmedabad) — `https://www.mosdac.gov.in`
2. **VEDAS** (Visualisation of Earth Data and Archival System, SAC Ahmedabad) — `https://vedas.sac.gov.in`
3. **Bhoonidhi** (National Remote Sensing Centre Open EO Data Hub, NRSC Hyderabad) — `https://bhoonidhi.nrsc.gov.in`
4. **Bhuvan** (Geoportal of ISRO / NRSC, Hyderabad) — `https://bhuvan.nrsc.gov.in`

---

## 3-Tier Ingestion & Fallback Architecture

TerraPulse employs a resilient, zero-failure 3-tier data access strategy designed for operational continuity even during communications degradation:

```
┌────────────────────────────────────────────────────────┐
│  Tier 1: Live Portal Endpoints (HTTP API / OGC WFS)    │
│  (Configured via MOSDAC_*, VEDAS_*, BHOONIDHI_*, etc.) │
└──────────────────────────┬─────────────────────────────┘
                           │ (Falls back on network/auth failure)
                           ▼
┌────────────────────────────────────────────────────────┐
│  Tier 2: Real Local Sample Drops (`real_samples/`)     │
│  (STAC JSON / GeoJSON / CSV / GeoTIFF downloads)       │
└──────────────────────────┬─────────────────────────────┘
                           │ (Falls back if local files missing)
                           ▼
┌────────────────────────────────────────────────────────┐
│  Tier 3: Seed Catchment Fallback (Sehore-Bhopal Basin) │
│  (`backend/app/data/seed_catchment.geojson`)           │
└────────────────────────────────────────────────────────┘
```

Every normalized GeoJSON feature includes a `data_source_origin` property:
* `"live_portal"` — Successfully fetched from active ISRO portal API
* `"local_sample"` — Ingested and parsed from this `real_samples/` directory
* `"seed_fallback"` — Reverted to verified seeded catchment baseline

---

## 1. MOSDAC Directory (`real_samples/mosdac/`)
* `insat3ds_rainfall_hourly.json`: INSAT-3DS TIR1/Sounder convective precipitation grid product with brightness temperature (`K`), rainfall rate (`mm/hr`), and bounding box.
* `gsmap_isro_precip_catchment.csv`: Tabular station and 0.1° grid rainfall observations across Kothri Kalan, Sehore, and Bhopal basins.

---

## 2. VEDAS Directory (`real_samples/vedas/`)
* `cartosat_dem_roads_profile.json`: Cartosat DEM-derived road network with elevation attributes (differentiating low causeway at 462.5m AMSL from high ridge corridor at 514m AMSL).
* `vedas_crop_phenology_sehore.json`: VEDAS crop condition, NDVI anomaly, soil moisture, and automated PMFBY parametric insurance eligibility records.

---

## 3. Bhoonidhi Directory (`real_samples/bhoonidhi/`)
* `eos04_sar_flood_stac.json`: STAC Item GeoJSON containing EOS-04 (RISAT-1A) C-band SAR cloud-penetrating water extraction polygon along Sevan River floodplain with Otsu backscatter thresholding (`<-16.5 dB`) and modeled water depth (`1.85m`).
* `sar_backscatter_transect.csv`: Ground-calibrated SAR radar backscatter dB transect points along the river reach.

---

## 4. Bhuvan Directory (`real_samples/bhuvan/`)
* `bhuvan_critical_infrastructure.geojson`: Cadastral POI features including hospitals (CHC Kothri Kalan), high-ground shelters (VIT Bhopal University Auditorium), gram panchayat muster posts, schools, and checkdams.
* `bhuvan_lulc_waterbodies.json`: National Water Body Information System reservoir levels (Sevan checkdam, Kerwa dam, Kaliasot spillway) and panchayat flood vulnerability rankings.

---

## Configuration Variables

Set these environment variables in `.env` to customize source loading:

```bash
# MOSDAC Configuration
MOSDAC_API_URL=https://mosdac.gov.in/api/v1/precipitation/insat3ds/hourly
MOSDAC_SAMPLE_PATH=app/data/real_samples/mosdac/insat3ds_rainfall_hourly.json
RAINFALL_THRESHOLD_MM_HR=15.0

# VEDAS Configuration
VEDAS_API_URL=https://vedas.sac.gov.in/api/v1/dem/cartosat/drainage
VEDAS_SAMPLE_PATH=app/data/real_samples/vedas/cartosat_dem_roads_profile.json
VEDAS_AGRI_SAMPLE_PATH=app/data/real_samples/vedas/vedas_crop_phenology_sehore.json

# Bhoonidhi Configuration
BHOONIDHI_API_URL=https://bhoonidhi.nrsc.gov.in/api/v1/sar/eos04/inundation
BHOONIDHI_SAMPLE_PATH=app/data/real_samples/bhoonidhi/eos04_sar_flood_stac.json

# Bhuvan Configuration
BHUVAN_WFS_URL=https://bhuvan.nrsc.gov.in/api/wfs/v1/critical_facilities
BHUVAN_SAMPLE_PATH=app/data/real_samples/bhuvan/bhuvan_critical_infrastructure.geojson
BHUVAN_LULC_SAMPLE_PATH=app/data/real_samples/bhuvan/bhuvan_lulc_waterbodies.json
```
