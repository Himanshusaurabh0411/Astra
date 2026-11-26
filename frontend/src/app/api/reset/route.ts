import { NextResponse } from "next/server";
import { resetServerState } from "@/lib/serverState";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST() {
  const store = resetServerState();
  return NextResponse.json(
    {
      ...store,
      connection: "api",
    },
    {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    }
  );
}
