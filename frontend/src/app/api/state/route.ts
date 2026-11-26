import { NextResponse } from "next/server";
import { getServerStore } from "@/lib/serverState";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const store = getServerStore();
  return NextResponse.json(
    {
      ...store,
      connection: "api",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    }
  );
}
