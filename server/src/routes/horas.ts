import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { calcularHoras } from "../lib/asistencia.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

interface HorasQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
}

interface ResumenEmpleado {
  nombre: string;
  totalHoras: number;
  enCurso: boolean;
}

export async function horasRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: HorasQuery }>(
    "/api/horas",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { sucursalId } = request.query;
      const desde = request.query.desde || inicioDeMesAR();
      const hasta = request.query.hasta || hoyAR();

      const turnos = await calcularHoras(request.org!.id, { desde, hasta, sucursalId });

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

      return { desde, hasta, turnos, resumen };
    }
  );
}
