import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import {
  listHorarios,
  insertHorario,
  updateHorario,
  deleteHorario,
  insertHorariosBulk,
  listTurnoTemplates,
  insertTurnoTemplate,
  deleteTurnoTemplate,
  getTolerancia,
  setTolerancia,
  calcularCumplimiento,
} from "../lib/turnos.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

interface HorariosQuery {
  empleadoId?: string;
}

interface CrearHorarioBody {
  empleado_id?: string;
  sucursal_id?: string | null;
  dia_semana?: number;
  hora_inicio?: string;
  hora_fin?: string;
  tolerancia_min?: number | null;
}

interface EditarHorarioBody {
  sucursal_id?: string | null;
  dia_semana?: number;
  hora_inicio?: string;
  hora_fin?: string;
  tolerancia_min?: number | null;
}

interface BulkBody {
  empleado_ids?: string[];
  dias_semana?: number[];
  hora_inicio?: string;
  hora_fin?: string;
  tolerancia_min?: number | null;
}

interface TemplateBody {
  nombre?: string;
  hora_inicio?: string;
  hora_fin?: string;
  dias_semana?: number[];
  tolerancia_min?: number | null;
}

interface ToleranciaBody {
  tolerancia_min?: number;
}

interface CumplimientoQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  empleadoId?: string;
}

interface IdParams {
  id: string;
}

export async function turnosRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: HorariosQuery }>(
    "/api/horarios",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => listHorarios(request.org!.id, request.query.empleadoId)
  );

  app.post<{ Body: CrearHorarioBody }>(
    "/api/horarios",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { empleado_id, sucursal_id, dia_semana, hora_inicio, hora_fin, tolerancia_min } = request.body ?? {};
      if (!empleado_id || dia_semana === undefined || !hora_inicio || !hora_fin) {
        return reply.code(400).send({ error: "Faltan datos del turno" });
      }
      await insertHorario(request.org!.id, { empleado_id, sucursal_id, dia_semana, hora_inicio, hora_fin, tolerancia_min });
      return { ok: true };
    }
  );

  app.patch<{ Params: IdParams; Body: EditarHorarioBody }>(
    "/api/horarios/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const body = request.body ?? {};
      const patch: Parameters<typeof updateHorario>[2] = {};
      if (body.sucursal_id !== undefined) patch.sucursal_id = body.sucursal_id;
      if (body.dia_semana !== undefined) patch.dia_semana = body.dia_semana;
      if (body.hora_inicio !== undefined) patch.hora_inicio = body.hora_inicio;
      if (body.hora_fin !== undefined) patch.hora_fin = body.hora_fin;
      if (body.tolerancia_min !== undefined) patch.tolerancia_min = body.tolerancia_min;
      await updateHorario(request.org!.id, request.params.id, patch);
      return { ok: true };
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/horarios/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      await deleteHorario(request.org!.id, request.params.id);
      return { ok: true };
    }
  );

  app.post<{ Body: BulkBody }>(
    "/api/horarios/bulk",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { empleado_ids, dias_semana, hora_inicio, hora_fin, tolerancia_min } = request.body ?? {};
      if (!empleado_ids?.length || !dias_semana?.length || !hora_inicio || !hora_fin) {
        return reply.code(400).send({ error: "Faltan datos para asignar el turno" });
      }
      await insertHorariosBulk(request.org!.id, { empleado_ids, dias_semana, hora_inicio, hora_fin, tolerancia_min });
      return { ok: true };
    }
  );

  app.get("/api/turno-templates", { preHandler: [requireAuth, requireOrg] }, async (request) =>
    listTurnoTemplates(request.org!.id)
  );

  app.post<{ Body: TemplateBody }>(
    "/api/turno-templates",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { nombre, hora_inicio, hora_fin, dias_semana, tolerancia_min } = request.body ?? {};
      if (!nombre?.trim() || !hora_inicio || !hora_fin) {
        return reply.code(400).send({ error: "Faltan datos de la plantilla" });
      }
      try {
        await insertTurnoTemplate(request.org!.id, {
          nombre: nombre.trim(),
          hora_inicio,
          hora_fin,
          dias_semana: dias_semana ?? [],
          tolerancia_min,
        });
      } catch (e) {
        return reply.code(409).send({ error: e instanceof Error ? e.message : "No se pudo crear la plantilla" });
      }
      return { ok: true };
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/turno-templates/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      await deleteTurnoTemplate(request.org!.id, request.params.id);
      return { ok: true };
    }
  );

  app.get("/api/turnos/tolerancia", { preHandler: [requireAuth, requireOrg] }, async (request) => ({
    tolerancia_min: await getTolerancia(request.org!.id),
  }));

  app.patch<{ Body: ToleranciaBody }>(
    "/api/turnos/tolerancia",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const min = Number(request.body?.tolerancia_min);
      if (!Number.isFinite(min) || min < 0) {
        return reply.code(400).send({ error: "tolerancia_min inválida" });
      }
      await setTolerancia(request.org!.id, Math.round(min));
      return { ok: true };
    }
  );

  app.get<{ Querystring: CumplimientoQuery }>(
    "/api/turnos/cumplimiento",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const desde = request.query.desde ?? inicioDeMesAR();
      const hasta = request.query.hasta ?? hoyAR();
      return calcularCumplimiento(request.org!.id, {
        desde,
        hasta,
        sucursalId: request.query.sucursalId,
        empleadoId: request.query.empleadoId,
      });
    }
  );
}
