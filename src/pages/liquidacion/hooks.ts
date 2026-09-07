import { useQuery } from "@tanstack/react-query";
import { getLiquidacion, type LiquidacionFiltros } from "../../lib/api";

export function useLiquidacion(filters: LiquidacionFiltros) {
  return useQuery({
    queryKey: ["liquidacion", filters],
    queryFn: ({ signal }) => getLiquidacion(filters, signal),
    enabled: !!filters.desde && !!filters.hasta && filters.desde <= filters.hasta,
  });
}
