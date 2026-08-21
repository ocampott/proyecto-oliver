import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listEmpleados,
  createEmpleado,
  updateEmpleado,
  eliminarEmpleado,
  desvincularDispositivo,
  generarOtp,
  type CrearEmpleadoInput,
  type EditarEmpleadoInput,
} from "../../lib/api";

const QUERY_KEY = ["empleados"];

export function useEmpleados() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listEmpleados });
}

export function useCrearEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearEmpleadoInput) => createEmpleado(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useEditarEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarEmpleadoInput }) => updateEmpleado(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useEliminarEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarEmpleado(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useDesvincularDispositivo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => desvincularDispositivo(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export function useGenerarOtp() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => generarOtp(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
