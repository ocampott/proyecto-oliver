"use client";

import { useCallback, useEffect, useState } from "react";
import type { AsistenciaConNombres, Rechazada, MotivoRechazo } from "@/lib/asistencia";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

const MOTIVOS: Record<MotivoRechazo, string> = {
  fuera_de_rango: "Fuera de rango",
  sucursal_sin_gps: "Sucursal sin GPS configurado",
  nombre_no_encontrado: "Nombre no encontrado en la nómina",
  dispositivo_ya_vinculado: "Ya vinculado a otro dispositivo",
};

export default function AsistenciaClient() {
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [registros, setRegistros] = useState<AsistenciaConNombres[]>([]);
  const [rechazadas, setRechazadas] = useState<Rechazada[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [resReg, resRech] = await Promise.all([
        fetch(`/api/asistencia?desde=${desde}&hasta=${hasta}`),
        fetch("/api/asistencia/rechazadas"),
      ]);
      if (!resReg.ok || !resRech.ok) {
        setError("No se pudieron cargar los datos. Probá de nuevo.");
        return;
      }
      setRegistros(await resReg.json());
      setRechazadas(await resRech.json());
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  async function handleBorrar(id: string) {
    if (!confirm("¿Borrar este registro?")) return;
    const res = await fetch(`/api/asistencia?id=${id}`, { method: "DELETE" });
    if (res.ok) cargar();
    else setError("No se pudo borrar el registro.");
  }

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    const res = await fetch(`/api/asistencia/rechazadas/${id}?accion=${accion}`, { method: "POST" });
    if (res.ok) {
      cargar();
    } else {
      const body = await res.json().catch(() => null);
      setError(body?.error ?? "No se pudo resolver el intento.");
    }
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Asistencia</h1>

      {rechazadas.length > 0 && (
        <section className="mt-6">
          <h2 className="text-lg font-semibold">Intentos rechazados</h2>
          <table className="mt-2 w-full text-left text-sm">
            <thead>
              <tr>
                <th className="border-b p-2">Fecha</th>
                <th className="border-b p-2">Empleado</th>
                <th className="border-b p-2">Sucursal</th>
                <th className="border-b p-2">Motivo</th>
                <th className="border-b p-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {rechazadas.map((r) => (
                <tr key={r.id}>
                  <td className="border-b p-2">{horaLocal(r.created_at)}</td>
                  <td className="border-b p-2">{r.empleado_nombre ?? "—"}</td>
                  <td className="border-b p-2">{r.sucursal_nombre ?? "—"}</td>
                  <td className="border-b p-2">
                    {MOTIVOS[r.motivo] ?? r.motivo}
                    {r.motivo === "fuera_de_rango" && r.distancia_metros != null && (
                      <span className="text-neutral-500"> (a {r.distancia_metros} m)</span>
                    )}
                    {r.tipo && <span className="text-neutral-500"> — {r.tipo}</span>}
                  </td>
                  <td className="border-b p-2">
                    <div className="flex gap-2">
                      <button onClick={() => handleResolver(r.id, "aprobar")} className="underline">
                        Aprobar
                      </button>
                      <button onClick={() => handleResolver(r.id, "descartar")} className="underline">
                        Descartar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <section className="mt-6">
        <div className="flex flex-wrap items-end gap-2">
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

        <table className="mt-4 w-full text-left text-sm">
          <thead>
            <tr>
              <th className="border-b p-2">Fecha y hora</th>
              <th className="border-b p-2">Empleado</th>
              <th className="border-b p-2">Sucursal</th>
              <th className="border-b p-2">Tipo</th>
              <th className="border-b p-2"></th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.id}>
                <td className="border-b p-2">{horaLocal(r.created_at)}</td>
                <td className="border-b p-2">{r.empleado_nombre ?? "—"}</td>
                <td className="border-b p-2">{r.sucursal_nombre ?? "—"}</td>
                <td className="border-b p-2">{r.tipo}</td>
                <td className="border-b p-2">
                  <button onClick={() => handleBorrar(r.id)} className="underline">
                    Borrar
                  </button>
                </td>
              </tr>
            ))}
            {registros.length === 0 && (
              <tr>
                <td colSpan={5} className="border-b p-2 text-neutral-500">
                  No hay registros en este rango.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
