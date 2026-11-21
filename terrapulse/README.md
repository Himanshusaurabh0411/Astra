# 🛰️ TerraPulse: Turning Satellite Data into Real-World Decisions

> **ASTRA 2026 Hackathon · ANTERiX Club · VIT Bhopal University**  
> **Team Zero Latency · Dual-Domain Fusion (Domain 03: Disaster Management + Domain 04: SatCom & NavIC)**

TerraPulse is an integrated geospatial intelligence and tactical rescue coordination platform that unifies India's four primary Earth observation portals (**MOSDAC, Bhoonidhi, VEDAS, and Bhuvan**) to transform complex satellite telemetry into real-world decisions across agricultural stress, water resources, and disaster risk; and simultaneously solves the critical last-mile communication blackout through passive **NavIC positioning** and an **offline peer-to-peer LoRa mesh relay**.

---

## 🏗️ Architecture & 4-Portal Fusion Matrix

| Portal | Center | Mission / Products | Operational Role in TerraPulse |
|:-------|:-------|:-------------------|:-------------------------------|
| **MOSDAC** | SAC, Ahmedabad | INSAT-3DS & GSMaP (0.1°) | 0–6h advance flash-flood warning alerts (>15 mm/hr trigger) |
| **Bhoonidhi** | NRSC, Hyderabad | NISAR & EOS-04 SAR | All-weather cloud-penetrating radar flood extent extraction |
| **VEDAS** | SAC, Ahmedabad | Cartosat DEM & STAL AI | Hydrological slope analysis, submerged road classification |
| **Bhuvan** | NRSC, Hyderabad | 1:50,000 LULC & Cadastres | Administrative asset triage (hospitals, schools, shelters) |

---

## ⚡ The 4-Step Golden Path (Live Demo Flow)

1. **Step 1: MOSDAC Rain Alert** — Automated worker detects convective rainfall anomaly (>15 mm/hr).
2. **Step 2: Bhoonidhi SAR Water Extraction** — Microwave radar pierces storm clouds, extracts flood polygon.
3. **Step 3: VEDAS Road Submergence & Routing** — DEM routes runoff, classifies impassable roads, and computes dry evacuation routes to Bhuvan shelters.
4. **Step 4: Off-Grid NavIC & LoRa Mesh Dispatch** — Evacuation vector compressed into `<48 KB packet`, pushed to field responder PWA running in airplane mode; citizen SOS distress beacons tracked.

---

## 🚀 Quickstart

### Option 1: Docker Compose
```bash
docker compose up --build
```
- Web GIS Command Center: `http://localhost:3000`
- FastAPI Backend & API Docs: `http://localhost:8000/docs`

### Option 2: Local Development
**Backend:**
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

---

## 📜 Contracts & Schemas
- `contracts/geojson_feature.schema.json` — Standardized geospatial layer format
- `contracts/sos_packet.schema.json` — Compact LoRa beacon format (<128 bytes)
- `contracts/dispatch_vector.schema.json` — Compressed offline evacuation corridor (<48 KB)
