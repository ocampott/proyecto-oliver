import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { createEmpleado, listEmpleados } from "@/lib/empleados";

export async function GET() {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const empleados = await listEmpleados(ctx.org.id);
  return NextResponse.json(empleados);
}

export async function POST(req: NextRequest) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const body = (await req.json().catch(() => null)) as
    | { nombre?: string; celular?: string }
    | null;
  if (!body?.nombre?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 });
  }

  const empleado = await createEmpleado(ctx.org.id, {
    nombre: body.nombre.trim(),
    celular: body.celular?.trim() || undefined,
  });
  return NextResponse.json(empleado, { status: 201 });
}
