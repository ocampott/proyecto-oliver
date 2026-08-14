import type { FastifyInstance } from "fastify";
import { getOrgBySlug } from "../lib/org.js";
import { getSucursal } from "../lib/sucursales.js";
import { getEmpleadoByToken } from "../lib/empleados.js";
import { getDeviceToken } from "../lib/device-token.js";

interface EstadoQuery {
  org: string;
  sucursal: string;
}

export async function marcarRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: EstadoQuery }>("/api/marcar/estado", async (request, reply) => {
    const { org: orgSlug, sucursal: sucursalId } = request.query;
    if (!orgSlug || !sucursalId) {
      return reply.code(400).send({ error: "Faltan datos" });
    }

    const org = await getOrgBySlug(orgSlug);
    const sucursal = org ? await getSucursal(org.id, sucursalId) : null;
    if (!org || !sucursal || !sucursal.activa) {
      return reply.code(404).send({
        error: "Este enlace no es válido o la sucursal está desactivada. Pedile el QR correcto a tu encargado.",
      });
    }

    const token = getDeviceToken(request);
    const empleado = token ? await getEmpleadoByToken(token) : null;
    const nombre = empleado && empleado.org_id === org.id ? empleado.nombre : null;

    return { sucursalNombre: sucursal.nombre, empleadoNombre: nombre };
  });
}
