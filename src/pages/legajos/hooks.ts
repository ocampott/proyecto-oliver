import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { getLegajos, getLegajo, subirLegajoArchivo, eliminarLegajoArchivo } from "../../lib/api";

export function useLegajos(params: { page: number; pageSize: number; q?: string }) {
  return useQuery({
    queryKey: ["legajos", params],
    queryFn: () => getLegajos(params),
    placeholderData: keepPreviousData,
  });
}

export function useLegajo(empleadoId: string) {
  return useQuery({ queryKey: ["legajo", empleadoId], queryFn: () => getLegajo(empleadoId), enabled: !!empleadoId });
}

export function useSubirLegajoArchivo(empleadoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => subirLegajoArchivo(empleadoId, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legajo", empleadoId] });
      queryClient.invalidateQueries({ queryKey: ["legajos"] });
    },
  });
}

export function useEliminarLegajoArchivo(empleadoId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (archivoId: string) => eliminarLegajoArchivo(empleadoId, archivoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["legajo", empleadoId] });
      queryClient.invalidateQueries({ queryKey: ["legajos"] });
    },
  });
}
