import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listEmpleados,
  listEmpleadosPaginado,
  createEmpleado,
  updateEmpleado,
  eliminarEmpleado,
  desvincularDispositivo,
  generarOtp,
  getVacaciones,
  type CrearEmpleadoInput,
  type EditarEmpleadoInput,
  type ListEmpleadosParams,
} from "../../lib/api";

const QUERY_KEY = ["empleados"];

export function useEmpleados() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listEmpleados });
}

export function useVacaciones() {
  return useQuery({ queryKey: ["vacaciones"], queryFn: () => getVacaciones() });
}

export function useEmpleadosPaginado(params: ListEmpleadosParams) {
  return useQuery({
    queryKey: [...QUERY_KEY, params],
    queryFn: () => listEmpleadosPaginado(params),
    placeholderData: keepPreviousData,
  });
}

export function useCrearEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearEmpleadoInput) => createEmpleado(input),
    onSuccess: () => Promise.all(
      ["empleados", "legajos", "legajo", "vacaciones", "liquidacion"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    ),
  });
}

export function useEditarEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarEmpleadoInput }) => updateEmpleado(id, patch),
    onSuccess: () => Promise.all(
      ["empleados", "legajos", "legajo", "vacaciones", "liquidacion"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    ),
  });
}

export function useEliminarEmpleado() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eliminarEmpleado(id),
    onSuccess: () => Promise.all(
      ["empleados", "legajos", "legajo", "vacaciones", "liquidacion"].map((key) =>
        queryClient.invalidateQueries({ queryKey: [key] })
      )
    ),
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
