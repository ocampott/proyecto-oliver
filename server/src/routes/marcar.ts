import type { FastifyInstance } from "fastify";
import { getOrgBySlug } from "../lib/org.js";
import { getSucursal } from "../lib/sucursales.js";
import { getEmpleadoByToken, buscarEnNomina } from "../lib/empleados.js";
import { getDeviceToken } from "../lib/device-token.js";
import { generarOtp } from "../lib/otp.js";
import { registrarRechazo } from "../lib/asistencia.js";

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

  interface IdentificarBody {
    orgSlug?: string;
    sucursalId?: string;
    nombre?: string;
  }

  app.post<{ Body: IdentificarBody }>("/api/marcar/identificar", async (request, reply) => {
    const { orgSlug, sucursalId, nombre } = request.body ?? {};
    if (!orgSlug || !sucursalId || !nombre?.trim()) {
      return reply.code(400).send({ error: "Faltan datos" });
    }

    const org = await getOrgBySlug(orgSlug);
    if (!org) {
      return reply.code(404).send({ error: "Organización no encontrada" });
    }
    const sucursal = await getSucursal(org.id, sucursalId);
    if (!sucursal || !sucursal.activa) {
      return reply.code(404).send({ error: "Sucursal no encontrada" });
    }

    const resultado = await buscarEnNomina(org.id, nombre.trim());
    if (!resultado) {
      await registrarRechazo(org.id, {
        sucursal_id: sucursal.id,
        motivo: "nombre_no_encontrado",
      });
      return reply.code(404).send({
        error: "No encontramos ese nombre en la nómina. Escribilo como figura en tu recibo o avisale a tu encargado.",
      });
    }

    const { empleado, exacto } = resultado;

    if (empleado.device_token) {
      await registrarRechazo(org.id, {
        empleado_id: empleado.id,
        sucursal_id: sucursal.id,
        motivo: "dispositivo_ya_vinculado",
      });
      return reply.code(409).send({
        error: "Este nombre ya está vinculado a otro dispositivo. Avisale a tu encargado.",
      });
    }

    if (!exacto) {
      return { sugerencia: empleado.nombre };
    }

    await generarOtp(org.id, empleado.id);
    return { empleadoId: empleado.id };
  });
}
