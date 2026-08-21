import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getAusencias,
  createAusencia,
  updateAusencia,
  deleteAusencia,
  getRrhhCategorias,
  setRrhhCategorias,
  type CrearAusenciaInput,
  type EditarAusenciaInput,
} from "../../lib/api";

export function useAusencias(filters: {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
}) {
  return useQuery({
    queryKey: ["ausencias", filters],
    queryFn: () => getAusencias(filters),
  });
}

export function useCrearAusencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearAusenciaInput) => createAusencia(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ausencias"] }),
  });
}

export function useEditarAusencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarAusenciaInput }) => updateAusencia(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ausencias"] }),
  });
}

export function useBorrarAusencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAusencia(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["ausencias"] }),
  });
}

export function useRrhhCategorias() {
  return useQuery({ queryKey: ["rrhh-categorias"], queryFn: getRrhhCategorias });
}

export function useGuardarCategorias() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (categorias: string[]) => setRrhhCategorias(categorias),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rrhh-categorias"] }),
  });
}
