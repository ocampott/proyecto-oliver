import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listOrganizationsAdmin,
  createOrganizationAdmin,
  updateOrganizationAdmin,
  getOrgResumenAdmin,
  getSuscripcionesAdmin,
  createSuscripcionAdmin,
  cancelSuscripcionAdmin,
  listMiembrosAdmin,
  listEmpleadosAdmin,
  listSucursalesAdmin,
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

export function useEditarOrganizacionAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => updateOrganizationAdmin(id, name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ORGS_KEY }),
  });
}

export function useOrgResumenAdmin(orgId: string) {
  return useQuery({ queryKey: ["admin-org-resumen", orgId], queryFn: () => getOrgResumenAdmin(orgId) });
}

export function useMiembrosAdminOrg(orgId: string) {
  return useQuery({ queryKey: ["admin-org-miembros", orgId], queryFn: () => listMiembrosAdmin(orgId) });
}

export function useEmpleadosAdminOrg(orgId: string) {
  return useQuery({ queryKey: ["admin-org-empleados", orgId], queryFn: () => listEmpleadosAdmin(orgId) });
}

export function useSucursalesAdminOrg(orgId: string) {
  return useQuery({ queryKey: ["admin-org-sucursales", orgId], queryFn: () => listSucursalesAdmin(orgId) });
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
