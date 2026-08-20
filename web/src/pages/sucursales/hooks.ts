import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listSucursales,
  createSucursal,
  updateSucursal,
  deactivateSucursal,
  type CrearSucursalInput,
  type EditarSucursalInput,
} from "../../lib/api";

export { useOrgActual } from "../../lib/hooks";

const QUERY_KEY = ["sucursales"];

export function useSucursales() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listSucursales });
}

export function useCrearSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearSucursalInput) => createSucursal(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useEditarSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarSucursalInput }) => updateSucursal(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDesactivarSucursal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deactivateSucursal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
