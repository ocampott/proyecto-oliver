import { useQuery } from "@tanstack/react-query";
import { getOrgActual } from "./api";

export function useOrgActual() {
  return useQuery({ queryKey: ["org"], queryFn: getOrgActual });
}
