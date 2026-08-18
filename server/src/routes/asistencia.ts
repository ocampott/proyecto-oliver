import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import {
  listAsistencia,
  deleteAsistencia,
  listRechazadas,
  aprobarRechazada,
  descartarRechazada,
} from "../lib/asistencia.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

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
        desde: desde ?? hoyAR(),
        hasta: hasta ?? hoyAR(),
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
}
