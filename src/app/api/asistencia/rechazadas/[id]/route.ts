import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { aprobarRechazada, descartarRechazada } from "@/lib/asistencia";

interface Ctx {
  params: Promise<{ id: string }>;
}

// POST /api/asistencia/rechazadas/[id]?accion=aprobar|descartar
export async function POST(req: NextRequest, { params }: Ctx) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { id } = await params;
  const accion = new URL(req.url).searchParams.get("accion");

  try {
    if (accion === "aprobar") {
      await aprobarRechazada(ctx.org.id, id);
    } else if (accion === "descartar") {
      await descartarRechazada(ctx.org.id, id);
    } else {
      return NextResponse.json({ error: "Acción inválida" }, { status: 400 });
    }
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "No se pudo resolver el intento" },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
