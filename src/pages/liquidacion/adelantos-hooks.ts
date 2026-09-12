import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listAdelantos,
  crearAdelanto,
  deleteAdelanto,
  getTopeAdelanto,
  getTopeAdelantoConfig,
  setTopeAdelantoConfig,
  type ListAdelantosFilters,
  type CrearAdelantoInput,
  type TopeAdelantoConfig,
} from "../../lib/api";

export function useAdelantos(filters: ListAdelantosFilters) {
  return useQuery({
    queryKey: ["adelantos", filters],
    queryFn: () => listAdelantos(filters),
  });
}

export function useTopeAdelanto(empleadoId: string, fecha: string) {
  return useQuery({
    queryKey: ["adelantos-tope", empleadoId, fecha],
    queryFn: () => getTopeAdelanto(empleadoId, fecha),
    enabled: !!empleadoId && !!fecha,
  });
}

export function useCrearAdelanto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearAdelantoInput) => crearAdelanto(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adelantos"] });
      queryClient.invalidateQueries({ queryKey: ["adelantos-tope"] });
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
    },
  });
}

export function useBorrarAdelanto() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAdelanto(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adelantos"] });
      queryClient.invalidateQueries({ queryKey: ["adelantos-tope"] });
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
    },
  });
}

export function useTopeAdelantoConfig() {
  return useQuery({
    queryKey: ["adelantos-tope-config"],
    queryFn: getTopeAdelantoConfig,
  });
}

export function useActualizarTopeConfig() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: TopeAdelantoConfig) => setTopeAdelantoConfig(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["adelantos-tope-config"] });
      queryClient.invalidateQueries({ queryKey: ["adelantos-tope"] });
    },
  });
}
