import { NextResponse } from "next/server";
import { INDIA_REGIONS } from "@/lib/regions";

export async function GET() {
  return NextResponse.json(INDIA_REGIONS);
}
