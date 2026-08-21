import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getHorarios,
  createHorario,
  updateHorario,
  deleteHorario,
  asignarHorarios,
  getTurnoTemplates,
  createTurnoTemplate,
  deleteTurnoTemplate,
  getTolerancia,
  setTolerancia,
  getCumplimiento,
  type CrearHorarioInput,
  type EditarHorarioInput,
  type AsignarHorariosInput,
  type CrearTurnoTemplateInput,
} from "../../lib/api";

export function useHorarios(empleadoId: string) {
  return useQuery({
    queryKey: ["horarios", empleadoId],
    queryFn: () => getHorarios(empleadoId),
    enabled: !!empleadoId,
  });
}

export function useCrearHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearHorarioInput) => createHorario(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["horarios"] });
      queryClient.invalidateQueries({ queryKey: ["cumplimiento"] });
    },
  });
}

export function useEditarHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarHorarioInput }) => updateHorario(id, patch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["horarios"] });
      queryClient.invalidateQueries({ queryKey: ["cumplimiento"] });
    },
  });
}

export function useBorrarHorario() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHorario(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["horarios"] });
      queryClient.invalidateQueries({ queryKey: ["cumplimiento"] });
    },
  });
}

export function useAsignarHorarios() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: AsignarHorariosInput) => asignarHorarios(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["horarios"] });
      queryClient.invalidateQueries({ queryKey: ["cumplimiento"] });
    },
  });
}

export function useTurnoTemplates() {
  return useQuery({ queryKey: ["turno-templates"], queryFn: getTurnoTemplates });
}

export function useCrearPlantilla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearTurnoTemplateInput) => createTurnoTemplate(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["turno-templates"] }),
  });
}

export function useBorrarPlantilla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTurnoTemplate(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["turno-templates"] }),
  });
}

export function useTolerancia() {
  return useQuery({ queryKey: ["tolerancia"], queryFn: getTolerancia });
}

export function useGuardarTolerancia() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (min: number) => setTolerancia(min),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tolerancia"] });
      queryClient.invalidateQueries({ queryKey: ["cumplimiento"] });
    },
  });
}

export function useCumplimiento(filters: { desde: string; hasta: string; sucursalId?: string; empleadoId?: string }) {
  return useQuery({
    queryKey: ["cumplimiento", filters],
    queryFn: () => getCumplimiento(filters),
  });
}
