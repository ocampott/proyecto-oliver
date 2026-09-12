import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getHorarios,
  createHorario,
  updateHorario,
  deleteHorario,
  asignarHorarios,
  getTurnoTemplates,
  createTurnoTemplate,
  updateTurnoTemplate,
  deleteTurnoTemplate,
  getTolerancia,
  setTolerancia,
  getCumplimiento,
  getInasistencias,
  getTurnosPuntuales,
  createTurnoPuntual,
  deleteTurnoPuntual,
  type CrearHorarioInput,
  type EditarHorarioInput,
  type AsignarHorariosInput,
  type CrearTurnoTemplateInput,
  type EditarTurnoTemplateInput,
  type CrearTurnoPuntualInput,
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
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
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
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
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
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
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
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
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

export function useEditarPlantilla() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EditarTurnoTemplateInput }) => updateTurnoTemplate(id, patch),
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
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
    },
  });
}

export function useCumplimiento(filters: { desde: string; hasta: string; sucursalId?: string; empleadoId?: string }) {
  return useQuery({
    queryKey: ["cumplimiento", filters],
    queryFn: () => getCumplimiento(filters),
  });
}

/** Una consulta por organización, no una por empleado. */
export function useTodosLosHorarios() {
  return useQuery({
    queryKey: ["horarios", "todos"],
    queryFn: ({ signal }) => getHorarios(undefined, signal),
  });
}

export function useInasistencias(filters: { desde: string; hasta: string; empleadoId?: string }) {
  return useQuery({
    queryKey: ["inasistencias", filters],
    queryFn: () => getInasistencias(filters),
  });
}

export function useTurnosPuntuales(filters: { empleadoId?: string; desde?: string; hasta?: string } = {}) {
  return useQuery({
    queryKey: ["turnos-puntuales", filters],
    queryFn: () => getTurnosPuntuales(filters),
  });
}

export function useCrearTurnoPuntual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearTurnoPuntualInput) => createTurnoPuntual(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turnos-puntuales"] });
      queryClient.invalidateQueries({ queryKey: ["cumplimiento"] });
      queryClient.invalidateQueries({ queryKey: ["inasistencias"] });
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
    },
  });
}

export function useBorrarTurnoPuntual() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteTurnoPuntual(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["turnos-puntuales"] });
      queryClient.invalidateQueries({ queryKey: ["cumplimiento"] });
      queryClient.invalidateQueries({ queryKey: ["inasistencias"] });
      queryClient.invalidateQueries({ queryKey: ["liquidacion"] });
    },
  });
}
