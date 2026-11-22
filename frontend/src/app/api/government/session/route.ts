import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    configured: true,
    officer: {
      email: "officer.ndma@gov.in",
      agency: "National Disaster Management Authority (NDMA)",
    },
  });
}
