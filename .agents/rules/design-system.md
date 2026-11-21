# TerraPulse Design System: "Orbital Survey"

Apply whenever modifying anything inside `frontend/`.

## Principles
- Cartographic mission-control aesthetic: survey-chart hairlines, faint topographic contour texture (inline SVG, 3–6% opacity), and subtle corner tick marks on primary panels.
- Color is strictly semantic: chrome stays neutral; hazards, thresholds, and mesh states pop cleanly.
- Telemetry and coordinates in `JetBrains Mono` / `IBM Plex Mono` (`tabular-nums`); micro-labels `10–11px` uppercase (`tracking-[0.12em]`); section headings in `Instrument Serif` or crisp display sans; body in `Plus Jakarta Sans` / `IBM Plex Sans`.
- Zero heavy new UI/map dependencies—build custom primitives with Tailwind CSS + inline SVG on top of the existing map setup.

## Tokens (define in `frontend/tailwind.config.*` + `src/app/globals.css`; avoid hard-coded hex in components)
- **Dark "Night Watch" (default):** `ink-950` `#070B14`, `ink-900` `#0B1220`, `ink-800` `#111A2C`, `ink-700` `#1B2740`, `ink-600` `#2A3A5C`; text `bone-50` `#EEF2F7`, `bone-300` `#A9B4C6`, `bone-500` `#6E7B93`.
- **Single Brand Accent:** Saffron-Ember `#FF8A3D`.
- **Domain Data Hues:** MOSDAC rain `#5BC0FF`, Bhoonidhi SAR water `#2DD4C4` -> `#1E6FD9`, VEDAS open `#9BE564` / submerged `#FF5D5D` / evacuation corridor `#F5D547`, Bhuvan assets `#B79CFF`, LoRa/NavIC mesh live `#4ADE80`.
- **Severity & Triage:** `NORMAL` `#4ADE80`, `WATCH` `#F5D547`, `WARNING` `#FF8A3D`, `CRITICAL` `#FF4D4D`.
- **Light "Survey Paper" (optional toggle):** page `#F4EFE4`, surface `#FBF8F1`, text `#14213D` (with AA-darkened data hues), persisted safely in `localStorage` inside `try/catch`.

## Non-Negotiables
- Preserve all existing API routes, WebSocket sync, types, and handlers in `frontend/src/lib/terrapulseClient.ts` and `frontend/src/lib/offlineStore.ts`. Restyle and restructure UI components only.
- Must render completely even when the FastAPI backend is offline (graceful fallback, loading skeletons, cached-data banner).
- WCAG AA contrast, visible focus rings, never rely on color alone, and honor `prefers-reduced-motion`.
- `npm run build` and `npx tsc --noEmit` inside `frontend/` must pass with zero errors.
