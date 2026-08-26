import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listSucursales,
  createSucursal,
  updateSucursal,
  deleteSucursal,
  type CrearSucursalInput,
  type EditarSucursalInput,
  type ListSucursalesParams,
} from "../../lib/api";

export { useOrgActual } from "../../lib/hooks";

const QUERY_KEY = "sucursales";

const DEFAULT_PARAMS: ListSucursalesParams = { page: 1, pageSize: 30 };

export function useSucursales(params: ListSucursalesParams = DEFAULT_PARAMS) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => listSucursales(params),
    placeholderData: keepPreviousData,
  });
}

export function useCrearSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearSucursalInput) => createSucursal(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useEditarSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarSucursalInput }) => updateSucursal(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}

export function useEliminarSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteSucursal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
  });
}
