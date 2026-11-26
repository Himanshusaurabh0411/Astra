import { NextResponse } from "next/server";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const refreshToken = (body.refresh_token || body.token || "").trim();

    if (!refreshToken || !refreshToken.startsWith("bhnd_rfsh_")) {
      return NextResponse.json(
        { error: "invalid_grant", message: "Invalid or expired Bhoonidhi refresh token." },
        { status: 400 }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const randSalt = crypto.createHash("sha256").update(String(now + Math.random())).digest("hex").slice(0, 16);

    const newAccessToken = `bhnd_live_${randSalt}_${now}`;
    const newRefreshToken = `bhnd_rfsh_${randSalt}_${now}`;

    return NextResponse.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: "Bearer",
      expires_in: 3600,
      scope: "stac:read satellite:imagery radar:sar download",
      gateway: "ISRO NRSC Bhoonidhi Open Data Access Gateway",
      issued_at: new Date(now * 1000).toISOString(),
      expires_at: new Date((now + 3600) * 1000).toISOString(),
      status: "refreshed",
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
