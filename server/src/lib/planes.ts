import { createServiceClient } from "./supabase-service.js";

export type PlanSlug = "gratis" | "basico" | "pro";

export type Modulo =
  | "asistencia"
  | "horas"
  | "turnos"
  | "rrhh"
  | "reportes"
  | "liquidacion"
  | "alertas"
  | "whatsapp"
  | "ia";

export interface PlanDef {
  slug: PlanSlug;
  nombre: string;
  maxSucursales: number | null;
  maxEmpleados: number | null;
  modulos: Modulo[];
  precioMensual: number | null;
}

export interface Entitlements {
  plan: PlanDef;
  suscripcion: { venceAt: string; periodoMeses: number } | null;
  maxSucursales: number | null;
  maxEmpleados: number | null;
  modulos: Modulo[];
}

export interface Periodo {
  meses: number;
  descuento: number;
}

export const PLANES: Record<PlanSlug, PlanDef> = {
  gratis: {
    slug: "gratis",
    nombre: "Gratis",
    maxSucursales: 1,
    maxEmpleados: 5,
    modulos: ["asistencia"],
    precioMensual: null,
  },
  basico: {
    slug: "basico",
    nombre: "Básico",
    maxSucursales: 3,
    maxEmpleados: 30,
    modulos: ["asistencia", "horas", "turnos", "rrhh", "reportes"],
    precioMensual: 50000,
  },
  pro: {
    slug: "pro",
    nombre: "Pro",
    maxSucursales: null,
    maxEmpleados: null,
    modulos: [
      "asistencia",
      "horas",
      "turnos",
      "rrhh",
      "reportes",
      "liquidacion",
      "alertas",
      "whatsapp",
      "ia",
    ],
    precioMensual: 120000,
  },
};

export const PERIODOS: Periodo[] = [
  { meses: 1, descuento: 0 },
  { meses: 3, descuento: 0.1 },
  { meses: 12, descuento: 0.2 },
];

export function precioPeriodo(planSlug: PlanSlug, meses: number): number {
  const plan = PLANES[planSlug];
  if (!plan.precioMensual) return 0;
  const periodo = PERIODOS.find((p) => p.meses === meses);
  if (!periodo) throw new Error("Período no válido");
  return Math.round(plan.precioMensual * meses * (1 - periodo.descuento));
}

export function precioPeriodoFormateado(planSlug: PlanSlug, meses: number): string {
  return precioPeriodo(planSlug, meses).toLocaleString("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });
}

export function tieneModulo(ent: Entitlements, modulo: Modulo): boolean {
  return ent.modulos.includes(modulo);
}

export function puedeCrearSucursal(ent: Entitlements, cantidadActual: number): boolean {
  if (ent.maxSucursales === null) return true;
  return cantidadActual < ent.maxSucursales;
}

export function puedeCrearEmpleado(ent: Entitlements, cantidadActual: number): boolean {
  if (ent.maxEmpleados === null) return true;
  return cantidadActual < ent.maxEmpleados;
}

export function planRequeridoParaModulo(modulo: Modulo): PlanSlug | null {
  for (const slug of ["basico", "pro"] as PlanSlug[]) {
    if (PLANES[slug].modulos.includes(modulo)) return slug;
  }
  return null;
}

interface SuscripcionRow {
  id: string;
  plan: PlanSlug;
  periodo_meses: number;
  vence_at: string;
  estado: string;
}

export async function getEntitlements(orgId: string): Promise<Entitlements> {
  const service = createServiceClient();

  const { data: org, error: orgErr } = await service
    .from("organizations")
    .select("plan")
    .eq("id", orgId)
    .single();
  if (orgErr) throw orgErr;

  const planCacheado = (org.plan as PlanSlug) ?? "gratis";

  const { data: activa, error: subErr } = await service
    .from("suscripciones")
    .select("id, plan, periodo_meses, vence_at, estado")
    .eq("org_id", orgId)
    .eq("estado", "activa")
    .maybeSingle();
  if (subErr) throw subErr;

  const ahora = new Date().toISOString();

  if (activa && activa.vence_at < ahora) {
    await service.from("suscripciones").update({ estado: "vencida" }).eq("id", activa.id);
    await service.from("organizations").update({ plan: "gratis" }).eq("id", orgId);
    const plan = PLANES.gratis;
    return {
      plan,
      suscripcion: null,
      maxSucursales: plan.maxSucursales,
      maxEmpleados: plan.maxEmpleados,
      modulos: plan.modulos,
    };
  }

  const planSlug: PlanSlug = activa?.plan ?? planCacheado;
  const plan = PLANES[planSlug] ?? PLANES.gratis;

  return {
    plan,
    suscripcion: activa
      ? { venceAt: activa.vence_at, periodoMeses: activa.periodo_meses }
      : null,
    maxSucursales: plan.maxSucursales,
    maxEmpleados: plan.maxEmpleados,
    modulos: plan.modulos,
  };
}
