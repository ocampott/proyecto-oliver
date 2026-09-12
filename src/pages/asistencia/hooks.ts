import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listAsistencia,
  listAsistenciaPaginada,
  deleteAsistencia,
  crearAsistenciaManual,
  editarAsistencia,
  listRechazadas,
  resolverRechazada,
  listHuerfanas,
  type ListAsistenciaParams,
  type MarcaManualInput,
  type EditarAsistenciaInput,
} from "../../lib/api";

const CLAVES_A_INVALIDAR = ["asistencia", "asistencia-huerfanas", "horas", "cumplimiento", "liquidacion", "pendientes"];

export function useAsistencia(desde: string, hasta: string) {
  return useQuery({
    queryKey: ["asistencia", desde, hasta],
    queryFn: () => listAsistencia(desde, hasta),
  });
}

export function useAsistenciaPaginada(desde: string, hasta: string, params: ListAsistenciaParams) {
  return useQuery({
    queryKey: ["asistencia", "paginada", desde, hasta, params],
    queryFn: () => listAsistenciaPaginada(desde, hasta, params),
    placeholderData: keepPreviousData,
  });
}

export function useRechazadas(params: { page: number; pageSize: number }) {
  return useQuery({
    queryKey: ["asistencia-rechazadas", params],
    queryFn: () => listRechazadas(params),
    placeholderData: keepPreviousData,
  });
}

export function useHuerfanas(desde: string, hasta: string) {
  return useQuery({
    queryKey: ["asistencia-huerfanas", desde, hasta],
    queryFn: () => listHuerfanas(desde, hasta),
  });
}

export function useBorrarAsistencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAsistencia(id),
    onSuccess: () => Promise.all(
      CLAVES_A_INVALIDAR.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
    ),
  });
}

export function useCrearAsistenciaManual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MarcaManualInput) => crearAsistenciaManual(input),
    onSuccess: () => Promise.all(
      CLAVES_A_INVALIDAR.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
    ),
  });
}

export function useEditarAsistencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EditarAsistenciaInput }) => editarAsistencia(id, input),
    onSuccess: () => Promise.all(
      CLAVES_A_INVALIDAR.map((key) => queryClient.invalidateQueries({ queryKey: [key] }))
    ),
  });
}

export function useResolverRechazada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: "aprobar" | "descartar" }) => resolverRechazada(id, accion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asistencia-rechazadas"] });
      queryClient.invalidateQueries({ queryKey: ["pendientes"] });
      queryClient.invalidateQueries({ queryKey: ["asistencia"] });
      queryClient.invalidateQueries({ queryKey: ["horas"] });
      queryClient.invalidateQueries({ queryKey: ["cumplimiento"] });
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
    },
  });
}
