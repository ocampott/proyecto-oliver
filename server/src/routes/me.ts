import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";

export async function meRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/me", { preHandler: requireAuth }, async (request) => {
    return { id: request.user!.id, email: request.user!.email };
  });
}
