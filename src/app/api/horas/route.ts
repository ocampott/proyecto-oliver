import { NextRequest, NextResponse } from "next/server";
import { requireOrg } from "@/lib/require-org";
import { calcularHoras } from "@/lib/asistencia";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

export async function GET(req: NextRequest) {
  const ctx = await requireOrg();
  if (!ctx) return NextResponse.json({ error: "No autorizado" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const desde = searchParams.get("desde") ?? inicioDeMesAR();
  const hasta = searchParams.get("hasta") ?? hoyAR();
  const sucursalId = searchParams.get("sucursalId") ?? undefined;

  const turnos = await calcularHoras(ctx.org.id, { desde, hasta, sucursalId });

  interface ResumenEmpleado {
    nombre: string;
    totalHoras: number;
    enCurso: boolean;
  }
  const porEmpleado = new Map<string, ResumenEmpleado>();
  for (const t of turnos) {
    let e = porEmpleado.get(t.empleado_id);
    if (!e) {
      e = { nombre: t.nombre, totalHoras: 0, enCurso: false };
      porEmpleado.set(t.empleado_id, e);
    }
    if (t.horas !== null) {
      e.totalHoras += t.horas;
    } else {
      e.enCurso = true;
    }
  }
  const resumen = Array.from(porEmpleado.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));

  return NextResponse.json({ desde, hasta, turnos, resumen });
}
