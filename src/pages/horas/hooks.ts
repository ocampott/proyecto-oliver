import { useQuery } from "@tanstack/react-query";
import { getHoras } from "../../lib/api";

export function useHoras(desde: string, hasta: string) {
  return useQuery({ queryKey: ["horas", desde, hasta], queryFn: () => getHoras(desde, hasta) });
}
