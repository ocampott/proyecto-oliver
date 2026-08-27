import type { CumplimientoRow, HorarioEmpleado } from "../../lib/api";
import type { StatusProps } from "../../components/ui/status";

// ponytail: cálculo aproximado por día-de-semana × rango — no descuenta
// ausencias ni feriados. Cruzar contra Ausencias si hace falta precisión,
// evaluar en una etapa posterior.
export function calcularHorasEsperadas(horarios: HorarioEmpleado[], desde: string, hasta: string): number {
  const minutosPorDia = new Map<number, number>();
  for (const h of horarios) {
    const [hI, mI] = h.hora_inicio.split(":").map(Number);
    const [hF, mF] = h.hora_fin.split(":").map(Number);
    const minutos = Math.max(0, hF * 60 + mF - (hI * 60 + mI));
    minutosPorDia.set(h.dia_semana, (minutosPorDia.get(h.dia_semana) ?? 0) + minutos);
  }
  let totalMinutos = 0;
  const cursor = new Date(`${desde}T00:00:00`);
  const fin = new Date(`${hasta}T00:00:00`);
  while (cursor <= fin) {
    totalMinutos += minutosPorDia.get(cursor.getDay()) ?? 0;
    cursor.setDate(cursor.getDate() + 1);
  }
  return totalMinutos / 60;
}

export const CON_DESVIO: CumplimientoRow["estado"][] = ["tarde", "salida_anticipada", "tarde_y_anticipada"];

export const ESTADO_INFO: Record<CumplimientoRow["estado"], { label: string; tone: StatusProps["tone"] }> = {
  a_horario: { label: "A horario", tone: "success" },
  tarde: { label: "Tarde", tone: "warning" },
  salida_anticipada: { label: "Salida anticipada", tone: "warning" },
  tarde_y_anticipada: { label: "Tarde y salida anticipada", tone: "warning" },
  sin_horario: { label: "Sin horario definido", tone: "neutral" },
};
