import type { FastifyReply, FastifyRequest } from "fastify";
import type { Organization } from "../lib/org.js";
import { getCurrentOrg } from "../lib/org.js";

declare module "fastify" {
  interface FastifyRequest {
    org?: Organization;
  }
}

/**
 * Debe encadenarse siempre después de requireAuth (necesita request.user
 * ya resuelto): `{ preHandler: [requireAuth, requireOrg] }`.
 */
export async function requireOrg(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const org = await getCurrentOrg(request.user!.id);
  if (!org) {
    reply.code(403).send({ error: "Tu cuenta todavía no está asociada a ninguna organización." });
    return;
  }
  request.org = org;
}
