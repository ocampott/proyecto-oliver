import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requirePlatformAdmin } from "../plugins/require-platform-admin.js";
import { createServiceClient } from "../lib/supabase-service.js";
import { createOrganization } from "../lib/organizations.js";
import { PERIODOS, PLANES, type PlanSlug } from "../lib/planes.js";

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

interface SuscripcionRow {
  id: string;
  org_id: string;
  plan: PlanSlug;
  periodo_meses: number;
  precio_total: number | null;
  inicia_at: string;
  vence_at: string;
  estado: string;
  notas: string | null;
  created_at: string;
}

interface CrearSuscripcionBody {
  plan?: PlanSlug;
  periodoMeses?: number;
  precioTotal?: number;
  notas?: string;
}

interface CancelarSuscripcionBody {
  estado?: string;
}

function sumarMeses(fecha: Date, meses: number): Date {
  const result = new Date(fecha);
  result.setMonth(result.getMonth() + meses);
  return result;
}

function calcularPrecioTotal(plan: PlanSlug, periodoMeses: number, precioManual?: number): number {
  if (typeof precioManual === "number") return precioManual;
  const planDef = PLANES[plan];
  if (!planDef.precioMensual) return 0;
  const periodo = PERIODOS.find((p) => p.meses === periodoMeses);
  if (!periodo) return 0;
  return Math.round(planDef.precioMensual * periodo.meses * (1 - periodo.descuento));
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

  app.get<{ Params: { id: string } }>(
    "/api/admin/organizations/:id/suscripciones",
    { preHandler: [requireAuth, requirePlatformAdmin] },
    async (request): Promise<{ suscripciones: SuscripcionRow[] }> => {
      const service = createServiceClient();
      const { data, error } = await service
        .from("suscripciones")
        .select("*")
        .eq("org_id", request.params.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return { suscripciones: data ?? [] };
    }
  );

  app.post<{ Params: { id: string }; Body: CrearSuscripcionBody }>(
    "/api/admin/organizations/:id/suscripciones",
    { preHandler: [requireAuth, requirePlatformAdmin] },
    async (request, reply) => {
      const { plan, periodoMeses, precioTotal, notas } = request.body ?? {};
      const periodosValidos = PERIODOS.map((p) => p.meses);

      if (!plan || !(plan in PLANES) || plan === "gratis") {
        return reply.code(400).send({ error: "Plan inválido" });
      }
      if (!periodoMeses || !periodosValidos.includes(periodoMeses)) {
        return reply.code(400).send({ error: "Período inválido" });
      }

      const service = createServiceClient();
      const orgId = request.params.id;

      const { data: activa } = await service
        .from("suscripciones")
        .select("id")
        .eq("org_id", orgId)
        .eq("estado", "activa")
        .maybeSingle();

      if (activa) {
        const { error: cancelErr } = await service
          .from("suscripciones")
          .update({ estado: "cancelada" })
          .eq("id", activa.id);
        if (cancelErr) throw cancelErr;
      }

      const ahora = new Date();
      const venceAt = sumarMeses(ahora, periodoMeses).toISOString();
      const precioFinal = calcularPrecioTotal(plan, periodoMeses, precioTotal);

      const { data: nueva, error: insertErr } = await service
        .from("suscripciones")
        .insert({
          org_id: orgId,
          plan,
          periodo_meses: periodoMeses,
          precio_total: precioFinal,
          inicia_at: ahora.toISOString(),
          vence_at: venceAt,
          estado: "activa",
          notas: notas?.trim() || null,
        })
        .select()
        .single();
      if (insertErr) throw insertErr;

      const { error: updateErr } = await service
        .from("organizations")
        .update({ plan })
        .eq("id", orgId);
      if (updateErr) throw updateErr;

      return reply.code(201).send(nueva);
    }
  );

  app.patch<{ Params: { id: string }; Body: CancelarSuscripcionBody }>(
    "/api/admin/suscripciones/:id",
    { preHandler: [requireAuth, requirePlatformAdmin] },
    async (request, reply) => {
      const { estado } = request.body ?? {};
      if (estado !== "cancelada") {
        return reply.code(400).send({ error: "Solo se permite cancelar una suscripción" });
      }

      const service = createServiceClient();
      const { data: actual, error: readErr } = await service
        .from("suscripciones")
        .select("id, org_id, estado")
        .eq("id", request.params.id)
        .single();
      if (readErr) throw readErr;

      const { error: updateErr } = await service
        .from("suscripciones")
        .update({ estado: "cancelada" })
        .eq("id", actual.id);
      if (updateErr) throw updateErr;

      if (actual.estado === "activa") {
        const { error: orgErr } = await service
          .from("organizations")
          .update({ plan: "gratis" })
          .eq("id", actual.org_id);
        if (orgErr) throw orgErr;
      }

      return { ok: true };
    }
  );
}
