import { useQuery } from "@tanstack/react-query";
import { getOrgActual, type Entitlements, type Modulo } from "./api";

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
