import { useAusencias } from "../../pages/rrhh/hooks";

function hoyAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function useAusenciasHoy() {
  const hoy = hoyAR();
  const { data, isLoading, isError } = useAusencias({ desde: hoy, hasta: hoy });
  return { isLoading, isError, ausencias: data?.ausencias ?? [] };
}
