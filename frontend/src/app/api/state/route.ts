import { NextResponse } from "next/server";
import { getServerStore } from "@/lib/serverState";

export async function GET() {
  const store = getServerStore();
  return NextResponse.json({
    ...store,
    connection: "api",
  });
}
