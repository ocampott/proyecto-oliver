import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { getCurrentOrg } from "../lib/org.js";
import { getEntitlements } from "../lib/planes.js";

export async function orgRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/org/current", { preHandler: requireAuth }, async (request, reply) => {
    const org = await getCurrentOrg(request.user!.id);
    if (!org) {
      return reply.code(404).send({
        error: "Tu cuenta todavía no está asociada a ninguna organización.",
      });
    }
    const entitlements = await getEntitlements(org.id, request.user!.id);
    return { ...org, plan: entitlements.plan.slug, entitlements };
  });
}
