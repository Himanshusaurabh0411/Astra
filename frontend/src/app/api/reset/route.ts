import { NextResponse } from "next/server";
import { resetServerState } from "@/lib/serverState";

export async function POST() {
  const store = resetServerState();
  return NextResponse.json({
    ...store,
    connection: "api",
  });
}
