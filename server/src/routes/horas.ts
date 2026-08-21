import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { calcularHoras, calcularResumenHoras } from "../lib/asistencia.js";
import { generarExcel, enviarExcel } from "../lib/excel.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function fechaHoraAR(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

interface HorasQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
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
      const resumen = calcularResumenHoras(turnos);

      return { desde, hasta, turnos, resumen };
    }
  );

  interface ExportQuery {
    desde?: string;
    hasta?: string;
  }

  app.get<{ Querystring: ExportQuery }>(
    "/api/horas/export",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const desde = request.query.desde || inicioDeMesAR();
      const hasta = request.query.hasta || hoyAR();

      const turnos = await calcularHoras(request.org!.id, { desde, hasta });
      const resumen = calcularResumenHoras(turnos);

      const buffer = await generarExcel([
        {
          nombre: "Resumen",
          columnas: [
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Total horas", key: "total", width: 14 },
            { header: "Estado", key: "estado", width: 18 },
          ],
          filas: resumen.map((r) => ({
            empleado: r.nombre,
            total: r.totalHoras,
            estado: r.enCurso ? "Turno en curso" : "—",
          })),
        },
        {
          nombre: "Turnos",
          columnas: [
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Sucursal", key: "sucursal", width: 22 },
            { header: "Entrada", key: "entrada", width: 20 },
            { header: "Salida", key: "salida", width: 20 },
            { header: "Horas", key: "horas", width: 12 },
          ],
          filas: turnos.map((t) => ({
            empleado: t.nombre,
            sucursal: t.sucursal_nombre,
            entrada: fechaHoraAR(t.entrada_at),
            salida: t.salida_at ? fechaHoraAR(t.salida_at) : "En curso",
            horas: t.horas ?? "—",
          })),
        },
      ]);

      return enviarExcel(reply, buffer, `horas_${desde}_${hasta}.xlsx`);
    }
  );
}
