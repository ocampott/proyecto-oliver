import type { FastifyReply, FastifyRequest } from "fastify";
import type { User } from "@supabase/supabase-js";
import { createAnonClient } from "../lib/supabase-anon.js";

declare module "fastify" {
  interface FastifyRequest {
    user?: User;
  }
}

export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;
  if (!token) {
    return reply.code(401).send({ error: "No autorizado" });
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return reply.code(401).send({ error: "No autorizado" });
  }

  request.user = data.user;
}
