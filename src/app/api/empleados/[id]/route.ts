import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { updateEmpleado, setEmpleadoActivo } from "@/lib/empleados";

interface Ctx {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const body = (await req.json().catch(() => null)) as
    | { nombre?: string; celular?: string | null; activo?: boolean }
    | null;
  if (!body) {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  if (typeof body.activo === "boolean") {
    await setEmpleadoActivo(ctx.org.id, id, body.activo);
  }

  const patch: { nombre?: string; celular?: string | null } = {};
  if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
  if (body.celular !== undefined) patch.celular = body.celular?.trim() || null;

  if (Object.keys(patch).length > 0) {
    const empleado = await updateEmpleado(ctx.org.id, id, patch);
    return NextResponse.json(empleado);
  }

  return NextResponse.json({ ok: true });
}

// Borrado lógico: desactiva al empleado (conserva el historial de asistencia).
export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  await setEmpleadoActivo(ctx.org.id, id, false);
  return NextResponse.json({ ok: true });
}
