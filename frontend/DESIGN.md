# 🛰️ TerraPulse Design System: "Orbital Survey"

> **ASTRA 2026 Hackathon · Team Zero Latency**  
> **Dual-Domain Fusion (Domain 03: Disaster Management + Domain 04: SatCom & NavIC)**

The **"Orbital Survey"** design system powers the user interface of **TerraPulse**, transforming multi-portal Earth observation satellite data (**MOSDAC, Bhoonidhi, VEDAS, Bhuvan**) and off-grid **NavIC + LoRa (865–867 MHz)** tactical mesh telemetry into an elite, responsive, cartographic command instrument.

---

## 🎨 1. Core Principles

1. **Cartographic Mission-Control**: Survey-chart hairlines (`border-ink-700`), faint topographic contour texture (SVG vector contours, 3–6% opacity), and subtle corner tick marks (`survey-ticks`) on primary telemetry panels.
2. **Strictly Semantic Color**: Chrome remains neutral (`ink-950` to `ink-700`); color is reserved exclusively for hazards, thresholds, portal domains, and mesh states.
3. **High-Density Tabular Telemetry**: Telemetry and coordinates render in `JetBrains Mono` / `IBM Plex Mono` with tabular numerals (`tabular-nums`); micro-labels in `10–11px` uppercase (`tracking-[0.12em]`); body copy in `Plus Jakarta Sans`.
4. **Zero Heavy Map Dependencies**: Built using pure Tailwind CSS and vector SVG projection on top of standard browser primitives, ensuring 100% offline functionality without Mapbox API tokens or network latency.

---

## 🌓 2. Color Token Architecture

### A. Dark "Night Watch" (Default C2 Operating Mode)
- **Viewport Background**: `ink-950` (`#070B14`)
- **Card & Bar Surface**: `ink-900` (`#0B1220`)
- **Inset Panels & Inactive Controls**: `ink-800` (`#111A2C`)
- **Hairlines & Grid Guides**: `ink-700` (`#1B2740`)
- **Active Dividers**: `ink-600` (`#2A3A5C`)
- **High-Contrast Text**: `bone-50` (`#EEF2F7`)
- **Secondary Labels**: `bone-300` (`#A9B4C6`)
- **Muted Metadata**: `bone-500` (`#6E7B93`)

### B. Single Brand Accent
- **Saffron-Ember**: `#FF8A3D` (`saffron-500`), celebrating India's space program heritage across critical callouts, active step tabs, and vector broadcast buttons.

### C. Domain Spatial Data Hues
| Portal | Mission / Center | Primary Hue | Semantic Role in TerraPulse |
|:---|:---|:---:|:---|
| **MOSDAC** | INSAT-3DS (SAC, Ahmedabad) | `#5BC0FF` | Convective precipitation nowcasting & cloudburst alert (`>15 mm/hr`) |
| **Bhoonidhi** | EOS-04 / NISAR SAR (NRSC, Hyderabad) | `#2DD4C4` → `#1E6FD9` | Cloud-penetrating all-weather radar flood extents & depth |
| **VEDAS** | Cartosat DEM (SAC, Ahmedabad) | `#9BE564` / `#FF5D5D` | Passable roads vs submerged low causeways |
| **VEDAS** | Cartosat Ridge Corridors | `#F5D547` | High-ground safe dry evacuation paths (`>510m AMSL`) |
| **Bhuvan** | Cadastres (NRSC, Hyderabad) | `#B79CFF` | Administrative asset triage (hospitals, shelters, schools) |
| **Domain 04** | NavIC L5+S & LoRa 865 MHz | `#4ADE80` | Off-grid peer-to-peer distress beacons & hardware position fix |

### D. Standardized Severity Tiers
- **`NORMAL`**: `#4ADE80` (Nominal river flow, open highways)
- **`WATCH`**: `#F5D547` (Catchment moisture saturation, elevated dam levels)
- **`WARNING`**: `#FF8A3D` (Spillway overflow watch, road access warnings)
- **`CRITICAL`**: `#FF4D4D` (Rainfall `>15 mm/hr`, road submerged, citizen trapped)

### E. Light "Survey Paper" (Toggleable Parchment Mode)
- **Page Background**: `#F4EFE4`
- **Surface**: `#FBF8F1`
- **Text**: `#14213D` (WCAG AA compliant contrast ratio > 11:1)
- **Persisted Safely**: Stored in `localStorage` inside `try/catch` without hydration flicker.

---

## 🧩 3. Component & Primitive Catalog (`src/components/primitives/`)

| Primitive | Props & Capabilities |
|:---|:---|
| **`SurveyCard`** | Renders hairline borders with corner tick marks (`survey-ticks`), optional topographic contour texture (`bg-topo-contours`), and variants (`default`, `inset`, `interactive`, `critical`). |
| **`StatusChip`** | High-contrast status pill with semantic variants (`normal`, `watch`, `warning`, `critical`, `mesh`, `offline`, `neutral`, `saffron`). |
| **`StatusDot`** | Pulsing or static telemetry indicator with halo ring. |
| **`BudgetMeter`** | Precision gauge showing payload consumption (`<100 KB` compact vector vs raw multi-GB rasters; `<128 B` LoRa packet budget). |
| **`KpiReadout`** | Dense monospace stat block with micro-label, unit, and severity chip. |
| **`SectionLabel`** | Survey-chart uppercase header with portal badges (`SAC AHMEDABAD`, `NRSC HYDERABAD`). |
| **`ThemeToggle`** | Frictionless toggle between Dark "Night Watch" and Light "Survey Paper". |

---

## 🛰️ 4. Screen Walkthrough

### 1. Central Command Dashboard (`/`)
- **Top C2 Header Bar**: Operational status chip (`CELL ONLINE` / `BLACKOUT MESH` / `BURST SYNC`), live rainfall meter, vector payload gauge, passive NavIC indicator, theme toggle, and direct link to `/field`.
- **Cartographic SVG Map (`CommandMap`)**: 
  - Survey coordinate grid lines (`23.10°N`, `77.05°E`).
  - Animated dry corridor flow lines (`anim-flow-corridor`).
  - Radar beacon ripples for active citizen SOS packets.
  - Floating Attribute Inspector Card with one-click **"Broadcast Vector to Field Mesh"**.
- **Judge 4-Step Scenario Rail (`JudgeDemoBar`)**:
  - Step 1: MOSDAC Rain Surge (`>15 mm/hr`).
  - Step 2: Bhoonidhi SAR Inundation & VEDAS Dry Corridor.
  - Step 3: Cellular Blackout Simulation (NavIC + LoRa 865 MHz).
  - Step 4: SOS Distress Beacon & Vector Push (`<100 KB`).
  - Reset Basin control for rapid judging iteration.
- **Collapsible Drawer**:
  - Tab 1: **C2 Triage & SOS** (active dispatches, incoming LoRa beacons, critical asset status).
  - Tab 2: **Agri Stress** (VEDAS NDVI phenology, soil moisture anomaly, PMFBY claim batch verification).
  - Tab 3: **Hydrology & Dams** (Upper Lake, Kerwa, Kaliasot, Sevan checkdam storage meters & risk matrix).

### 2. Tactical Field Responder PWA (`/field`)
- **Offline Reliability**: Operates completely in simulated airplane mode with local service worker caching (`sw.js`) and seeded Kothri Kalan basin features in IndexedDB.
- **Passive NavIC Geolocation**: Locks `L5+S_PASSIVE` coordinates with one-click presets for Sevan Causeway, Kothri GP, VIT Relief Shelter, and Ashta Ridge.
- **LoRa Mesh SOS Composer**: Composes micro-packets within `<128 Byte` budget, renders animated multi-hop relay graph (`NODE-FIELD-07 -> NODE-RIDGE-02 -> GATEWAY-CAMP-01`), and mirrors beacons onto the offline map canvas.
- **Sync to Command**: One-click backhaul synchronization when connectivity is re-established.

---

## 🛡️ 5. Accessibility & Motion Guarantees

- **WCAG AA Compliance**: High-contrast foreground/background ratios (>7:1 in dark mode, >11:1 in light mode).
- **Reduced Motion**: Respects `@media (prefers-reduced-motion: reduce)` by disabling flow dashes, beacon ripples, and pulse loops.
- **Keyboard Navigation**: All interactive elements, scenario rail buttons, and layer toggles include visible focus rings (`focus-visible:ring-2 focus-visible:ring-saffron-500`).
