import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { updateOrgActual, listMiembros, invitarMiembro, eliminarMiembro } from "../../lib/api";

export function useActualizarOrg() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => updateOrgActual(name),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["org"] }),
  });
}

export function useMiembros() {
  return useQuery({ queryKey: ["miembros"], queryFn: listMiembros });
}

export function useInvitarMiembro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (email: string) => invitarMiembro(email),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["miembros"] }),
  });
}

export function useEliminarMiembro() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => eliminarMiembro(userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["miembros"] }),
  });
}
