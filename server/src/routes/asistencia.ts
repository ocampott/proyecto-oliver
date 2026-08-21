import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import {
  listAsistencia,
  deleteAsistencia,
  listRechazadas,
  aprobarRechazada,
  descartarRechazada,
  type MotivoRechazo,
} from "../lib/asistencia.js";
import { generarExcel, enviarExcel } from "../lib/excel.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
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

const MOTIVOS: Record<MotivoRechazo, string> = {
  fuera_de_rango: "Fuera de rango",
  sucursal_sin_gps: "Sucursal sin GPS configurado",
  nombre_no_encontrado: "Nombre no encontrado en la nómina",
  dispositivo_ya_vinculado: "Ya vinculado a otro dispositivo",
};

interface ListQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  empleadoId?: string;
}

interface IdParams {
  id: string;
}

interface ResolverQuery {
  accion?: string;
}

export async function asistenciaRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ListQuery }>(
    "/api/asistencia",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { desde, hasta, sucursalId, empleadoId } = request.query;
      return listAsistencia(request.org!.id, {
        desde: desde || hoyAR(),
        hasta: hasta || hoyAR(),
        sucursalId,
        empleadoId,
      });
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/asistencia/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      await deleteAsistencia(request.org!.id, id);
      return { ok: true };
    }
  );

  app.get(
    "/api/asistencia/rechazadas",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      return listRechazadas(request.org!.id);
    }
  );

  app.post<{ Params: IdParams; Querystring: ResolverQuery }>(
    "/api/asistencia/rechazadas/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { id } = request.params;
      const { accion } = request.query;
      try {
        if (accion === "aprobar") {
          await aprobarRechazada(request.org!.id, id);
        } else if (accion === "descartar") {
          await descartarRechazada(request.org!.id, id);
        } else {
          return reply.code(400).send({ error: "Acción inválida" });
        }
      } catch (e) {
        return reply.code(400).send({
          error: e instanceof Error ? e.message : "No se pudo resolver el intento",
        });
      }
      return { ok: true };
    }
  );

  interface ExportQuery {
    desde?: string;
    hasta?: string;
  }

  app.get<{ Querystring: ExportQuery }>(
    "/api/asistencia/export",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const desde = request.query.desde || hoyAR();
      const hasta = request.query.hasta || hoyAR();

      const [registros, rechazadas] = await Promise.all([
        listAsistencia(request.org!.id, { desde, hasta }),
        listRechazadas(request.org!.id),
      ]);

      const buffer = await generarExcel([
        {
          nombre: "Registros",
          columnas: [
            { header: "Fecha y hora", key: "fecha", width: 20 },
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Sucursal", key: "sucursal", width: 22 },
            { header: "Tipo", key: "tipo", width: 12 },
          ],
          filas: registros.map((r) => ({
            fecha: fechaHoraAR(r.created_at),
            empleado: r.empleado_nombre ?? "—",
            sucursal: r.sucursal_nombre ?? "—",
            tipo: r.tipo === "entrada" ? "Entrada" : "Salida",
          })),
        },
        {
          nombre: "Rechazadas",
          columnas: [
            { header: "Fecha", key: "fecha", width: 20 },
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Sucursal", key: "sucursal", width: 22 },
            { header: "Tipo", key: "tipo", width: 12 },
            { header: "Motivo", key: "motivo", width: 32 },
            { header: "Distancia (m)", key: "distancia", width: 14 },
            { header: "Resuelto", key: "resuelto", width: 12 },
          ],
          filas: rechazadas.map((r) => ({
            fecha: fechaHoraAR(r.created_at),
            empleado: r.empleado_nombre ?? "—",
            sucursal: r.sucursal_nombre ?? "—",
            tipo: r.tipo === "entrada" ? "Entrada" : r.tipo === "salida" ? "Salida" : "—",
            motivo: MOTIVOS[r.motivo] ?? r.motivo,
            distancia: r.distancia_metros ?? "—",
            resuelto: r.resuelto ? "Sí" : "No",
          })),
        },
      ]);

      enviarExcel(reply, buffer, `asistencia_${desde}_${hasta}.xlsx`);
    }
  );
}
