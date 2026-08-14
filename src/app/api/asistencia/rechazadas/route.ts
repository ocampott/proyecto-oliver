import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { listRechazadas } from "@/lib/asistencia";

export async function GET() {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const rechazadas = await listRechazadas(ctx.org.id);
  return NextResponse.json(rechazadas);
}
