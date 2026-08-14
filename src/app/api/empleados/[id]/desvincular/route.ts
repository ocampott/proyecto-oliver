import { NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { desvincularDispositivo } from "@/lib/empleados";

interface Ctx {
  params: Promise<{ id: string }>;
}

// Quita el vínculo dispositivo↔empleado: la próxima vez que marque tiene que
// revincular con un código nuevo (spec §6.7).
export async function POST(_req: Request, { params }: Ctx) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  await desvincularDispositivo(ctx.org.id, id);
  return NextResponse.json({ ok: true });
}
