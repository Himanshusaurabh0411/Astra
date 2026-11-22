import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const email = body.email || "officer.ndma@gov.in";
    return NextResponse.json({
      email,
      agency: "National Disaster Management Authority (NDMA)",
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 400 });
  }
}
