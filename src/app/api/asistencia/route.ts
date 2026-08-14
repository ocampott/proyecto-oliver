import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { listAsistencia, deleteAsistencia } from "@/lib/asistencia";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

export async function GET(req: NextRequest) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde") ?? hoyAR();
  const hasta = searchParams.get("hasta") ?? hoyAR();
  const sucursalId = searchParams.get("sucursalId") ?? undefined;
  const empleadoId = searchParams.get("empleadoId") ?? undefined;

  const registros = await listAsistencia(ctx.org.id, { desde, hasta, sucursalId, empleadoId });
  return NextResponse.json(registros);
}

export async function DELETE(req: NextRequest) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Falta el id" }, { status: 400 });

  await deleteAsistencia(ctx.org.id, id);
  return NextResponse.json({ ok: true });
}
