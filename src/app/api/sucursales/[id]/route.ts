import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { updateSucursal } from "@/lib/sucursales";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | {
        nombre?: string;
        lat?: number | null;
        lon?: number | null;
        radio_metros?: number;
        activa?: boolean;
      }
    | null;
  if (!body) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const patch: Parameters<typeof updateSucursal>[2] = {};
  if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
  if (body.lat !== undefined) patch.lat = body.lat;
  if (body.lon !== undefined) patch.lon = body.lon;
  if (body.radio_metros !== undefined) patch.radio_metros = body.radio_metros;
  if (typeof body.activa === "boolean") patch.activa = body.activa;

  const sucursal = await updateSucursal(ctx.org.id, id, patch);
  return NextResponse.json(sucursal);
}

// Borrado lógico: desactiva la sucursal (conserva el historial de asistencia).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  await updateSucursal(ctx.org.id, id, { activa: false });
  return NextResponse.json({ ok: true });
}
