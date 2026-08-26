import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import {
  listAsistencia,
  listAsistenciaPaginada,
  deleteAsistencia,
  listRechazadas,
  resolverRechazada,
  type ListAsistenciaParams,
} from "../../lib/api";

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

export function useBorrarAsistencia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteAsistencia(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["asistencia"] }),
  });
}

export function useResolverRechazada() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, accion }: { id: string; accion: "aprobar" | "descartar" }) => resolverRechazada(id, accion),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["asistencia-rechazadas"] });
      queryClient.invalidateQueries({ queryKey: ["asistencia"] });
    },
  });
}
