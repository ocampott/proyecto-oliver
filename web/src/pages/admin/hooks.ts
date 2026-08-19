import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listOrganizationsAdmin, createOrganizationAdmin, type CrearOrganizacionInput } from "../../lib/api";

const QUERY_KEY = ["admin-organizations"];

export function useOrganizacionesAdmin() {
  return useQuery({ queryKey: QUERY_KEY, queryFn: listOrganizationsAdmin });
}

export function useCrearOrganizacionAdmin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CrearOrganizacionInput) => createOrganizationAdmin(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
