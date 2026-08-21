import { useQuery } from "@tanstack/react-query";
import { getOrgActual, type Entitlements, type Modulo, type Organization, type OrgRole } from "./api";

export function useOrgActual() {
  return useQuery({ queryKey: ["org"], queryFn: getOrgActual });
}

export function useEntitlements() {
  return useOrgActual().data?.entitlements ?? null;
}

/**
 * Espejo de tieneModulo() en el backend (proyecto-oliver-api/src/lib/planes.ts):
 * un superadmin (ilimitado) tiene acceso a todo, sin importar `modulos`.
 */
export function tieneModulo(ent: Entitlements | null, modulo: Modulo): boolean {
  if (!ent) return false;
  if (ent.ilimitado) return true;
  return ent.modulos.includes(modulo);
}

/**
 * Espejo de requireRole() en el backend (proyecto-oliver-api/src/middleware/require-role.ts):
 * un superadmin (ilimitado) bypasea el chequeo de rol, igual que bypasea plan.
 */
export function tieneRol(org: Organization | null, roles: OrgRole[]): boolean {
  if (!org) return false;
  if (org.entitlements.ilimitado) return true;
  return !!org.role && roles.includes(org.role);
}

/** Atajo para el caso más común: ¿puede este usuario gestionar (crear/editar/borrar), no solo ver? */
export function puedeGestionar(org: Organization | null): boolean {
  return tieneRol(org, ["owner", "admin"]);
}
