"use client";

import { useCallback, useEffect, useState } from "react";
import type { Turno } from "@/lib/asistencia";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function fechaHoraLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

interface ResumenEmpleado {
  nombre: string;
  totalHoras: number;
  enCurso: boolean;
}

interface HorasResponse {
  turnos: Turno[];
  resumen: ResumenEmpleado[];
}

export default function HorasClient() {
  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [data, setData] = useState<HorasResponse>({ turnos: [], resumen: [] });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/horas?desde=${desde}&hasta=${hasta}`);
      if (!res.ok) {
        setError("No se pudieron cargar los datos. Probá de nuevo.");
        return;
      }
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Horas trabajadas</h1>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          Desde
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="ml-1 rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          Hasta
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="ml-1 rounded border px-2 py-1"
          />
        </label>
        {loading && <span className="text-sm text-neutral-500">Cargando...</span>}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {data.resumen.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Resumen por empleado</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="border-b p-2">Empleado</th>
                <th className="border-b p-2">Total horas</th>
                <th className="border-b p-2">Estado</th>
              </tr>
            </thead>
            <tbody>
              {data.resumen.map((r) => (
                <tr key={r.nombre}>
                  <td className="border-b p-2">{r.nombre}</td>
                  <td className="border-b p-2">{r.totalHoras.toFixed(2)}</td>
                  <td className="border-b p-2">{r.enCurso ? "Turno en curso" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-6">
        <h2 className="text-lg font-semibold">Turnos</h2>
        <table className="mt-2 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="border-b p-2">Empleado</th>
              <th className="border-b p-2">Sucursal</th>
              <th className="border-b p-2">Entrada</th>
              <th className="border-b p-2">Salida</th>
              <th className="border-b p-2">Horas</th>
            </tr>
          </thead>
          <tbody>
            {data.turnos.map((t, i) => (
              <tr key={`${t.empleado_id}-${t.entrada_at}-${i}`}>
                <td className="border-b p-2">{t.nombre}</td>
                <td className="border-b p-2">{t.sucursal_nombre}</td>
                <td className="border-b p-2">{fechaHoraLocal(t.entrada_at)}</td>
                <td className="border-b p-2">
                  {t.salida_at ? fechaHoraLocal(t.salida_at) : "En curso"}
                </td>
                <td className="border-b p-2">{t.horas !== null ? t.horas.toFixed(2) : "—"}</td>
              </tr>
            ))}
            {data.turnos.length === 0 && (
              <tr>
                <td colSpan={5} className="border-b p-2 text-neutral-500">
                  No hay turnos en este rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
