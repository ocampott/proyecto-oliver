import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import {
  listAusencias,
  insertAusencia,
  updateAusencia,
  deleteAusencia,
  getRrhhCategorias,
  setRrhhCategorias,
  calcularResumenAusencias,
} from "../lib/rrhh.js";
import { getEmpleadoById } from "../lib/empleados.js";
import { getSucursal } from "../lib/sucursales.js";
import { generarExcel, enviarExcel } from "../lib/excel.js";

interface ListQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
}

interface CrearAusenciaBody {
  empleado_id?: string;
  sucursal_id?: string | null;
  fecha_desde?: string;
  fecha_hasta?: string;
  motivo?: string;
  detalle?: string | null;
  contacto?: string | null;
  certificado_pendiente?: boolean;
}

interface EditarAusenciaBody {
  sucursal_id?: string | null;
  fecha_desde?: string;
  fecha_hasta?: string;
  motivo?: string;
  detalle?: string | null;
  contacto?: string | null;
  certificado_pendiente?: boolean;
}

interface CategoriasBody {
  categorias?: string[];
}

interface IdParams {
  id: string;
}

export async function rrhhRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: ListQuery }>(
    "/api/ausencias",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const ausencias = await listAusencias(request.org!.id, request.query);
      return { ausencias, resumen: calcularResumenAusencias(ausencias) };
    }
  );

  app.post<{ Body: CrearAusenciaBody }>(
    "/api/ausencias",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { empleado_id, sucursal_id, fecha_desde, fecha_hasta, motivo, detalle, contacto, certificado_pendiente } =
        request.body ?? {};
      if (!empleado_id || !fecha_desde || !fecha_hasta || !motivo?.trim()) {
        return reply.code(400).send({ error: "Faltan datos de la ausencia" });
      }
      const empleado = await getEmpleadoById(empleado_id);
      if (!empleado || empleado.org_id !== request.org!.id) {
        return reply.code(400).send({ error: "Empleado inválido" });
      }
      if (sucursal_id) {
        const sucursal = await getSucursal(request.org!.id, sucursal_id);
        if (!sucursal) {
          return reply.code(400).send({ error: "Sucursal inválida" });
        }
      }
      await insertAusencia(request.org!.id, {
        empleado_id,
        sucursal_id,
        fecha_desde,
        fecha_hasta,
        motivo: motivo.trim(),
        detalle,
        contacto,
        certificado_pendiente,
      });
      return { ok: true };
    }
  );

  app.patch<{ Params: IdParams; Body: EditarAusenciaBody }>(
    "/api/ausencias/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const body = request.body ?? {};
      if (body.sucursal_id !== undefined && body.sucursal_id !== null) {
        const sucursal = await getSucursal(request.org!.id, body.sucursal_id);
        if (!sucursal) {
          return reply.code(400).send({ error: "Sucursal inválida" });
        }
      }
      const patch: Parameters<typeof updateAusencia>[2] = {};
      if (body.sucursal_id !== undefined) patch.sucursal_id = body.sucursal_id;
      if (body.fecha_desde !== undefined) patch.fecha_desde = body.fecha_desde;
      if (body.fecha_hasta !== undefined) patch.fecha_hasta = body.fecha_hasta;
      if (body.motivo !== undefined) {
        if (!body.motivo.trim()) {
          return reply.code(400).send({ error: "Faltan datos de la ausencia" });
        }
        patch.motivo = body.motivo.trim();
      }
      if (body.detalle !== undefined) patch.detalle = body.detalle;
      if (body.contacto !== undefined) patch.contacto = body.contacto;
      if (body.certificado_pendiente !== undefined) patch.certificado_pendiente = body.certificado_pendiente;
      await updateAusencia(request.org!.id, request.params.id, patch);
      return { ok: true };
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/ausencias/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      await deleteAusencia(request.org!.id, request.params.id);
      return { ok: true };
    }
  );

  app.get("/api/settings/rrhh-categorias", { preHandler: [requireAuth, requireOrg] }, async (request) => ({
    categorias: await getRrhhCategorias(request.org!.id),
  }));

  app.patch<{ Body: CategoriasBody }>(
    "/api/settings/rrhh-categorias",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const categorias = request.body?.categorias;
      if (!Array.isArray(categorias) || categorias.some((c) => typeof c !== "string" || !c.trim())) {
        return reply.code(400).send({ error: "Categorías inválidas" });
      }
      await setRrhhCategorias(request.org!.id, categorias);
      return { ok: true };
    }
  );

  app.get<{ Querystring: ListQuery }>(
    "/api/ausencias/export",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const ausencias = await listAusencias(request.org!.id, request.query);

      const buffer = await generarExcel([
        {
          nombre: "Ausencias",
          columnas: [
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Sucursal", key: "sucursal", width: 22 },
            { header: "Fecha desde", key: "desde", width: 14 },
            { header: "Fecha hasta", key: "hasta", width: 14 },
            { header: "Motivo", key: "motivo", width: 24 },
            { header: "Certificado pendiente", key: "certificado", width: 20 },
            { header: "Detalle", key: "detalle", width: 32 },
            { header: "Contacto", key: "contacto", width: 22 },
          ],
          filas: ausencias.map((a) => ({
            empleado: a.empleado_nombre,
            sucursal: a.sucursal_nombre ?? "—",
            desde: a.fecha_desde,
            hasta: a.fecha_hasta,
            motivo: a.motivo,
            certificado: a.certificado_pendiente ? "Sí" : "No",
            detalle: a.detalle ?? "",
            contacto: a.contacto ?? "",
          })),
        },
      ]);

      const desde = request.query.desde ?? "todas";
      const hasta = request.query.hasta ?? "todas";
      return enviarExcel(reply, buffer, `rrhh_${desde}_${hasta}.xlsx`);
    }
  );
}
