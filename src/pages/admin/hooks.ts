import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOrganizationsAdmin,
  createOrganizationAdmin,
  getSuscripcionesAdmin,
  createSuscripcionAdmin,
  cancelSuscripcionAdmin,
  type CrearOrganizacionInput,
  type CrearSuscripcionAdminInput,
} from "../../lib/api";

const ORGS_KEY = ["admin-organizations"];

export function useOrganizacionesAdmin() {
  return useQuery({ queryKey: ORGS_KEY, queryFn: listOrganizationsAdmin });
}

export function useCrearOrganizacionAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearOrganizacionInput) => createOrganizationAdmin(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORGS_KEY }),
  });
}

function suscripcionesKey(orgId: string | null) {
  return ["admin-suscripciones", orgId];
}

export function useSuscripcionesAdmin(orgId: string | null) {
  return useQuery({
    queryKey: suscripcionesKey(orgId),
    queryFn: () => getSuscripcionesAdmin(orgId!),
    enabled: !!orgId,
  });
}

export function useCrearSuscripcionAdmin(orgId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearSuscripcionAdminInput) => createSuscripcionAdmin(orgId!, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGS_KEY });
      queryClient.invalidateQueries({ queryKey: suscripcionesKey(orgId) });
    },
  });
}

export function useCancelarSuscripcionAdmin(orgId: string | null) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => cancelSuscripcionAdmin(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ORGS_KEY });
      queryClient.invalidateQueries({ queryKey: suscripcionesKey(orgId) });
    },
  });
}
