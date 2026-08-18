import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { listEmpleados, createEmpleado, updateEmpleado, setEmpleadoActivo } from "../lib/empleados.js";
import { getOtpVigente } from "../lib/otp.js";

interface CrearBody {
  nombre?: string;
  celular?: string;
}

interface EditarBody {
  nombre?: string;
  celular?: string | null;
  activo?: boolean;
}

interface IdParams {
  id: string;
}

export async function empleadosRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/empleados", { preHandler: [requireAuth, requireOrg] }, async (request) => {
    const empleados = await listEmpleados(request.org!.id);
    return Promise.all(
      empleados.map(async (e) => {
        if (e.device_token) return { ...e, otp: null };
        const otp = await getOtpVigente(e.id);
        return { ...e, otp: otp ? { code: otp.code, expires_at: otp.expires_at } : null };
      })
    );
  });

  app.post<{ Body: CrearBody }>(
    "/api/empleados",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { nombre, celular } = request.body ?? {};
      if (!nombre?.trim()) {
        return reply.code(400).send({ error: "El nombre es requerido" });
      }
      const empleado = await createEmpleado(request.org!.id, {
        nombre: nombre.trim(),
        celular: celular?.trim() || undefined,
      });
      return reply.code(201).send(empleado);
    }
  );

  app.patch<{ Params: IdParams; Body: EditarBody }>(
    "/api/empleados/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      const body = request.body ?? {};

      if (typeof body.activo === "boolean") {
        await setEmpleadoActivo(request.org!.id, id, body.activo);
      }

      const patch: { nombre?: string; celular?: string | null } = {};
      if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
      if (body.celular !== undefined) patch.celular = body.celular?.trim() || null;

      if (Object.keys(patch).length > 0) {
        return updateEmpleado(request.org!.id, id, patch);
      }
      return { ok: true };
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/empleados/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      await setEmpleadoActivo(request.org!.id, id, false);
      return { ok: true };
    }
  );
}
