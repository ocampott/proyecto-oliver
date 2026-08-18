import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { listSucursales, createSucursal, updateSucursal, getSucursal } from "../lib/sucursales.js";
import { env } from "../env.js";

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

  app.get<{ Params: IdParams }>(
    "/api/sucursales/:id/qr",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { id } = request.params;
      const sucursal = await getSucursal(request.org!.id, id);
      if (!sucursal) {
        return reply.code(404).send({ error: "Sucursal no encontrada" });
      }
      const url = `${env.marcarBaseUrl}/marcar/${request.org!.slug}/${sucursal.id}`;
      const png = await QRCode.toBuffer(url, { width: 600, margin: 2 });
      reply.header("Content-Type", "image/png");
      reply.header("Content-Disposition", `inline; filename="qr-${sucursal.nombre}.png"`);
      return reply.send(png);
    }
  );
}
