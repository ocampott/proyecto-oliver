import type { FastifyReply, FastifyRequest } from "fastify";
import { isPlatformAdmin } from "../lib/admin.js";

/**
 * Debe encadenarse siempre después de requireAuth (necesita request.user
 * ya resuelto): `{ preHandler: [requireAuth, requirePlatformAdmin] }`.
 * A diferencia de requireOrg, NO requiere que el usuario tenga una
 * organización — un platform admin puede no tener ninguna.
 */
export async function requirePlatformAdmin(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const isAdmin = await isPlatformAdmin(request.user!.id);
  if (!isAdmin) {
    reply.code(403).send({ error: "No autorizado" });
    return;
  }
}
