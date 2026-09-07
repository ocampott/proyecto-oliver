import { useHoyArgentina } from "../../lib/useHoyArgentina";
import { useAusencias } from "../../pages/rrhh/hooks";


export function useAusenciasHoy() {
  const hoy = useHoyArgentina();
  const { data, isLoading, isError } = useAusencias({ desde: hoy, hasta: hoy });
  return { isLoading, isError, ausencias: (data?.ausencias ?? []).filter((a) => a.estado === "aprobada") };
}
