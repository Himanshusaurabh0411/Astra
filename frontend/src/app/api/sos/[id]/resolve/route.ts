import { NextResponse } from "next/server";
import { resolveServerSOS } from "@/lib/serverState";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  resolveServerSOS(id);
  return NextResponse.json({ status: "RESOLVED", sos_id: id });
}
