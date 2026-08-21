import { useQuery } from "@tanstack/react-query";
import { getOrgActual } from "./api";

export function useOrgActual() {
  return useQuery({ queryKey: ["org"], queryFn: getOrgActual });
}

export function useEntitlements() {
  return useOrgActual().data?.entitlements ?? null;
}
