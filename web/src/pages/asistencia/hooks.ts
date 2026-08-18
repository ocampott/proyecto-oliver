import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listAsistencia, deleteAsistencia, listRechazadas, resolverRechazada } from "../../lib/api";

export function useAsistencia(desde: string, hasta: string) {
  return useQuery({
    queryKey: ["asistencia", desde, hasta],
    queryFn: () => listAsistencia(desde, hasta),
  });
}

export function useRechazadas() {
  return useQuery({ queryKey: ["asistencia-rechazadas"], queryFn: listRechazadas });
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
