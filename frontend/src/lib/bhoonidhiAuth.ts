export interface BhoonidhiAuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  user_id: string;
  api_key_fingerprint: string;
  gateway: string;
  issued_at: string;
  expires_at: string;
  status: string;
}

export interface BhoonidhiRefreshResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
  issued_at: string;
  expires_at: string;
  status: string;
}

export interface BhoonidhiStacScene {
  scene_id: string;
  satellite: string;
  sensor: string;
  polarization: string;
  resolution_m: number;
  acquisition_time: string;
  bbox: number[];
  target: string;
  cloud_cover_pct: number;
  water_detected_km2: number;
  quicklook_url: string;
}

export interface BhoonidhiStacResponse {
  type: string;
  stac_version: string;
  id: string;
  description: string;
  matched: number;
  returned: number;
  scenes: BhoonidhiStacScene[];
  gateway: string;
  timestamp: string;
}

const DEFAULT_KEY = "1104f7577ce2f11b68c3f0ce0654d901e135134c";

export async function loginBhoonidhi(apiKey = DEFAULT_KEY): Promise<BhoonidhiAuthResponse> {
  const res = await fetch("/api/portal/bhoonidhi/auth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey }),
  });
  if (!res.ok) {
    throw new Error(`Bhoonidhi auth failed with status ${res.status}`);
  }
  return res.json();
}

export async function refreshBhoonidhiToken(refreshToken: string): Promise<BhoonidhiRefreshResponse> {
  const res = await fetch("/api/portal/bhoonidhi/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  if (!res.ok) {
    throw new Error(`Bhoonidhi token refresh failed with status ${res.status}`);
  }
  return res.json();
}

export async function searchBhoonidhiImagery(region = "brahmaputra", sensor = "EOS-04_SAR"): Promise<BhoonidhiStacResponse> {
  const query = new URLSearchParams({ region, sensor });
  const res = await fetch(`/api/portal/bhoonidhi/satellite/search?${query}`);
  if (!res.ok) {
    throw new Error(`Bhoonidhi satellite catalog search failed with status ${res.status}`);
  }
  return res.json();
}
