import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { listSucursales, createSucursal, updateSucursal } from "../lib/sucursales.js";

interface CrearBody {
  nombre?: string;
  lat?: number;
  lon?: number;
  radio_metros?: number;
}

interface EditarBody {
  nombre?: string;
  lat?: number | null;
  lon?: number | null;
  radio_metros?: number;
  activa?: boolean;
}

interface IdParams {
  id: string;
}

export async function sucursalesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/sucursales", { preHandler: [requireAuth, requireOrg] }, async (request) => {
    return listSucursales(request.org!.id);
  });

  app.post<{ Body: CrearBody }>(
    "/api/sucursales",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { nombre, lat, lon, radio_metros } = request.body ?? {};
      if (!nombre?.trim()) {
        return reply.code(400).send({ error: "El nombre es requerido" });
      }
      const sucursal = await createSucursal(request.org!.id, {
        nombre: nombre.trim(),
        lat,
        lon,
        radio_metros,
      });
      return reply.code(201).send(sucursal);
    }
  );

  app.patch<{ Params: IdParams; Body: EditarBody }>(
    "/api/sucursales/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      const body = request.body ?? {};
      const patch: Parameters<typeof updateSucursal>[2] = {};
      if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
      if (body.lat !== undefined) patch.lat = body.lat;
      if (body.lon !== undefined) patch.lon = body.lon;
      if (body.radio_metros !== undefined) patch.radio_metros = body.radio_metros;
      if (typeof body.activa === "boolean") patch.activa = body.activa;

      return updateSucursal(request.org!.id, id, patch);
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/sucursales/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      await updateSucursal(request.org!.id, id, { activa: false });
      return { ok: true };
    }
  );
}
