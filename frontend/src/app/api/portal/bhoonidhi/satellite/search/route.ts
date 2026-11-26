import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SATELLITE_CATALOG: Record<string, any[]> = {
  brahmaputra: [
    {
      scene_id: "EOS04_SAR_CRS_20261121_0042_ASSAM_FLOOD",
      satellite: "EOS-04 (RISAT-1A)",
      sensor: "C-band SAR (Fine Resolution Stripmap)",
      polarization: "HH+HV",
      resolution_m: 3.0,
      acquisition_time: "2026-11-21T00:42:18Z",
      bbox: [91.5, 25.8, 93.5, 27.2],
      target: "Assam Brahmaputra Valley Flood Inundation & Embankment Breach",
      cloud_cover_pct: 0.0,
      water_detected_km2: 412.5,
      quicklook_url: "https://bhuvan-app1.nrsc.gov.in/bhuvanapp/bhuvan_lulc.php",
      bands: ["HH", "HV", "Backscatter_Ratio"],
      assets: {
        radar_amplitude: { title: "Calibrated Radar Backscatter dB", type: "image/tiff" },
        flood_vector: { title: "Automated Inundation Mask GeoJSON", type: "application/geo+json" },
      },
    },
    {
      scene_id: "SENTINEL2_MSI_20261121_GUWAHATI_EXP",
      satellite: "Sentinel-2 MSI",
      sensor: "Multi-Spectral Instrument (B2, B3, B4, B8, B11, B12)",
      polarization: "Optical/SWIR",
      resolution_m: 10.0,
      acquisition_time: "2026-11-21T05:12:00Z",
      bbox: [91.2, 25.9, 92.8, 26.8],
      target: "Guwahati-Kamrup Surface Water & Siltation Index",
      cloud_cover_pct: 4.2,
      water_detected_km2: 185.0,
      quicklook_url: "https://bhuvan-app1.nrsc.gov.in/bhuvanapp/bhuvan_lulc.php",
      bands: ["B02_Blue", "B03_Green", "B04_Red", "B08_NIR", "MNDWI_WaterIndex"],
      assets: {
        mndwi: { title: "Modified Normalized Difference Water Index", type: "image/tiff" },
      },
    },
  ],
  "western-ghats": [
    {
      scene_id: "EOS04_SAR_FRS_20261121_0415_WAYANAD_TERRAIN",
      satellite: "EOS-04 (RISAT-1A)",
      sensor: "C-band SAR (Slant Range Terrain)",
      polarization: "VV+VH",
      resolution_m: 2.5,
      acquisition_time: "2026-11-21T04:15:30Z",
      bbox: [75.8, 11.2, 76.6, 11.9],
      target: "Wayanad Vythiri-Meppadi Landslide Scarp & High-Moisture Zone",
      cloud_cover_pct: 0.0,
      water_detected_km2: 18.2,
      quicklook_url: "https://bhuvan-app1.nrsc.gov.in/bhuvanapp/bhuvan_lulc.php",
      bands: ["VV", "VH", "Coherence_Interferogram"],
      assets: {
        terrain_coherence: { title: "InSAR Differential Coherence Mask", type: "image/tiff" },
      },
    },
  ],
  "central-india": [
    {
      scene_id: "EOS04_SAR_MRS_20261121_1200_SEHORE_BASIN",
      satellite: "EOS-04 (RISAT-1A)",
      sensor: "C-band SAR (Medium Resolution ScanSAR)",
      polarization: "HH",
      resolution_m: 10.0,
      acquisition_time: "2026-11-21T12:00:00Z",
      bbox: [76.8, 22.8, 77.8, 23.6],
      target: "Sevan River Catchment & Kothri Kalan Drainage Basin",
      cloud_cover_pct: 0.0,
      water_detected_km2: 4.2,
      quicklook_url: "https://bhuvan-app1.nrsc.gov.in/bhuvanapp/bhuvan_lulc.php",
      bands: ["HH", "Threshold_Mask"],
      assets: {
        water_mask: { title: "SAR Surface Water Inundation Polygon", type: "application/geo+json" },
      },
    },
  ],
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const region = (searchParams.get("region") || "brahmaputra").toLowerCase();
  const sensor = searchParams.get("sensor") || "EOS-04_SAR";

  let scenes = SATELLITE_CATALOG["central-india"];
  if (region.includes("assam") || region.includes("brahmaputra")) {
    scenes = SATELLITE_CATALOG.brahmaputra;
  } else if (region.includes("wayanad") || region.includes("ghat")) {
    scenes = SATELLITE_CATALOG["western-ghats"];
  }

  return NextResponse.json({
    type: "FeatureCollection",
    stac_version: "1.0.0",
    id: `bhoonidhi-stac-${region}`,
    description: `ISRO Bhoonidhi STAC satellite catalog for ${region} (${sensor})`,
    matched: scenes.length,
    returned: scenes.length,
    scenes,
    gateway: "ISRO NRSC Bhoonidhi Open Data Access Gateway",
    timestamp: new Date().toISOString(),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const region = (body.region || "brahmaputra").toLowerCase();
  const sensor = body.sensor || "EOS-04_SAR";

  let scenes = SATELLITE_CATALOG["central-india"];
  if (region.includes("assam") || region.includes("brahmaputra")) {
    scenes = SATELLITE_CATALOG.brahmaputra;
  } else if (region.includes("wayanad") || region.includes("ghat")) {
    scenes = SATELLITE_CATALOG["western-ghats"];
  }

  return NextResponse.json({
    type: "FeatureCollection",
    stac_version: "1.0.0",
    id: `bhoonidhi-stac-${region}`,
    description: `ISRO Bhoonidhi STAC satellite catalog for ${region} (${sensor})`,
    matched: scenes.length,
    returned: scenes.length,
    scenes,
    gateway: "ISRO NRSC Bhoonidhi Open Data Access Gateway",
    timestamp: new Date().toISOString(),
  });
}
