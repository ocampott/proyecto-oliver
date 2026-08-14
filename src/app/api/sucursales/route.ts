import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { createSucursal, listSucursales } from "@/lib/sucursales";

export async function GET() {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const sucursales = await listSucursales(ctx.org.id);
  return NextResponse.json(sucursales);
}

export async function POST(req: NextRequest) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { nombre?: string; lat?: number; lon?: number; radio_metros?: number }
    | null;
  if (!body?.nombre?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  const sucursal = await createSucursal(ctx.org.id, {
    nombre: body.nombre.trim(),
    lat: body.lat,
    lon: body.lon,
    radio_metros: body.radio_metros,
  });
  return NextResponse.json(sucursal, { status: 201 });
}
