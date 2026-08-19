import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requirePlatformAdmin } from "../plugins/require-platform-admin.js";
import { createServiceClient } from "../lib/supabase-service.js";
import { createOrganization } from "../lib/organizations.js";

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  plan: string;
  created_at: string;
}

interface CrearBody {
  name?: string;
  slug?: string;
}

export async function adminRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/api/admin/organizations",
    { preHandler: [requireAuth, requirePlatformAdmin] },
    async (): Promise<OrganizationRow[]> => {
      const service = createServiceClient();
      const { data, error } = await service
        .from("organizations")
        .select("id, name, slug, plan, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    }
  );

  app.post<{ Body: CrearBody }>(
    "/api/admin/organizations",
    { preHandler: [requireAuth, requirePlatformAdmin] },
    async (request, reply) => {
      const { name, slug } = request.body ?? {};
      if (!name?.trim() || !slug?.trim()) {
        return reply.code(400).send({ error: "name y slug son requeridos" });
      }
      try {
        const org = await createOrganization({ name: name.trim(), slug: slug.trim() });
        return reply.code(201).send(org);
      } catch (e) {
        return reply.code(400).send({
          error: e instanceof Error ? e.message : "Error al crear la organización",
        });
      }
    }
  );
}
