import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  getAusencias,
  createAusencia,
  updateAusencia,
  deleteAusencia,
  getRrhhCategorias,
  setRrhhCategorias,
  getAvisosUrgentes,
  type CrearAusenciaInput,
  type EditarAusenciaInput,
} from "../../lib/api";

export function useAvisosUrgentes() {
  return useQuery({ queryKey: ["avisos-urgentes"], queryFn: getAvisosUrgentes });
}

export function useAusencias(filters: {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
  motivo?: string;
  empleadoId?: string;
  page?: number;
  pageSize?: number;
}) {
  return useQuery({
    queryKey: ["ausencias", filters],
    queryFn: () => getAusencias(filters),
    placeholderData: keepPreviousData,
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
