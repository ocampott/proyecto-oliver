import { useMemo } from "react";
import { useHoras } from "../../pages/horas/hooks";

function hoyAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function fechaAR(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

function hace7Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

export function useOlvidaronSalida() {
  const hoy = hoyAR();
  const { data, isLoading, isError } = useHoras(hace7Dias(), hoy);

  const turnos = useMemo(() => {
    const abiertos = (data?.turnos ?? []).filter(
      (t) => t.salida_at === null && fechaAR(t.entrada_at) !== hoy
    );
    return abiertos.map((t) => ({
      empleadoId: t.empleado_id,
      nombre: t.nombre,
      sucursalNombre: t.sucursal_nombre,
      entradaAt: t.entrada_at,
    }));
  }, [data, hoy]);

  return { isLoading, isError, turnos };
}
