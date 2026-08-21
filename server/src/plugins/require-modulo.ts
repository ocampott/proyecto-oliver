import type { FastifyReply, FastifyRequest } from "fastify";
import { getEntitlements, planRequeridoParaModulo, tieneModulo, type Modulo } from "../lib/planes.js";

/**
 * Debe encadenarse siempre después de requireOrg (necesita request.org
 * ya resuelto): `{ preHandler: [requireAuth, requireOrg, requireModulo("horas")] }`.
 */
export function requireModulo(modulo: Modulo) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const ent = await getEntitlements(request.org!.id);
    if (!tieneModulo(ent, modulo)) {
      const planRequerido = planRequeridoParaModulo(modulo) ?? "basico";
      reply.code(403).send({
        error: "modulo_no_incluido",
        modulo,
        planRequerido,
      });
    }
  };
}
