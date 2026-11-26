import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

const DEFAULT_API_KEY = process.env.BHOONIDHI_API_TOKEN || process.env.BHUVAN_API_TOKEN || "1104f7577ce2f11b68c3f0ce0654d901e135134c";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const apiKey = (body.api_key || body.token || DEFAULT_API_KEY).trim();
    const username = body.username || "isro-nrsc-researcher";

    const now = Math.floor(Date.now() / 1000);
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
    const refreshHash = crypto.createHash("sha256").update(`${apiKey}_rfsh_${now}`).digest("hex").slice(0, 16);

    const accessToken = `bhnd_live_${keyHash}_${now}`;
    const refreshToken = `bhnd_rfsh_${refreshHash}_${now}`;
    const fingerprint = apiKey.length >= 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : apiKey;

    return NextResponse.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "stac:read satellite:imagery radar:sar download",
      user_id: username,
      api_key_fingerprint: fingerprint,
      gateway: "ISRO NRSC Bhoonidhi Open Data Access Gateway",
      issued_at: new Date(now * 1000).toISOString(),
      expires_at: new Date((now + 3600) * 1000).toISOString(),
      status: "authenticated",
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const apiKey = (searchParams.get("api_key") || searchParams.get("token") || DEFAULT_API_KEY).trim();
  const username = searchParams.get("username") || "isro-nrsc-researcher";

  const now = Math.floor(Date.now() / 1000);
  const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
  const refreshHash = crypto.createHash("sha256").update(`${apiKey}_rfsh_${now}`).digest("hex").slice(0, 16);

  const accessToken = `bhnd_live_${keyHash}_${now}`;
  const refreshToken = `bhnd_rfsh_${refreshHash}_${now}`;
  const fingerprint = apiKey.length >= 10 ? `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}` : apiKey;

  return NextResponse.json({
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: 3600,
    scope: "stac:read satellite:imagery radar:sar download",
    user_id: username,
    api_key_fingerprint: fingerprint,
    gateway: "ISRO NRSC Bhoonidhi Open Data Access Gateway",
    issued_at: new Date(now * 1000).toISOString(),
    expires_at: new Date((now + 3600) * 1000).toISOString(),
    status: "authenticated",
  });
}
