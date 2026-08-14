"use client";

import { useState } from "react";

interface Props {
  orgSlug: string;
  sucursalId: string;
  sucursalNombre: string;
  empleadoNombre: string | null;
}

type Etapa =
  | { tipo: "identificar" }
  | { tipo: "confirmar"; sugerencia: string }
  | { tipo: "codigo"; empleadoId: string }
  | { tipo: "marcar"; nombre: string };

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function MarcarClient({ orgSlug, sucursalId, sucursalNombre, empleadoNombre }: Props) {
  const [etapa, setEtapa] = useState<Etapa>(
    empleadoNombre ? { tipo: "marcar", nombre: empleadoNombre } : { tipo: "identificar" }
  );
  const [nombre, setNombre] = useState("");
  const [code, setCode] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function identificar(nombreAUsar: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marcar/identificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgSlug, sucursalId, nombre: nombreAUsar }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Algo salió mal. Probá de nuevo.");
        return;
      }
      if (body.sugerencia) {
        setEtapa({ tipo: "confirmar", sugerencia: body.sugerencia });
      } else {
        setEtapa({ tipo: "codigo", empleadoId: body.empleadoId });
      }
    } finally {
      setLoading(false);
    }
  }

  async function verificar(empleadoId: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/marcar/verificar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ empleadoId, code }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) {
        setError(body?.error ?? "Algo salió mal. Probá de nuevo.");
        return;
      }
      setEtapa({ tipo: "marcar", nombre: body.nombre });
    } finally {
      setLoading(false);
    }
  }

  function marcar(tipo: "entrada" | "salida") {
    setLoading(true);
    setError(null);
    setMensaje(null);

    if (!navigator.geolocation) {
      setError("Este navegador no soporta geolocalización. Probá con Chrome o Safari.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch("/api/marcar/registrar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sucursalId,
              tipo,
              lat: pos.coords.latitude,
              lon: pos.coords.longitude,
            }),
          });
          const body = await res.json().catch(() => null);
          if (!res.ok) {
            setError(body?.error ?? "Algo salió mal. Probá de nuevo.");
            return;
          }
          const label = body.tipo === "entrada" ? "Entrada" : "Salida";
          setMensaje(`${label} registrada a las ${horaLocal(body.hora)} ✔`);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(
          "Necesitamos tu ubicación para registrar la marca. Habilitá la geolocalización en el navegador y probá de nuevo."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <div className="w-full max-w-sm rounded-lg border p-6">
      <h1 className="text-xl font-semibold">{sucursalNombre}</h1>

      {etapa.tipo === "identificar" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            identificar(nombre);
          }}
          className="mt-4 space-y-4"
        >
          <p className="text-sm text-neutral-500">
            Escribí tu nombre y apellido como figura en la nómina.
          </p>
          <input
            required
            placeholder="Tu nombre y apellido"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="w-full rounded border px-3 py-2"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
          >
            Continuar
          </button>
        </form>
      )}

      {etapa.tipo === "confirmar" && (
        <div className="mt-4 space-y-4">
          <p>
            ¿Sos <strong>{etapa.sugerencia}</strong>?
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => identificar(etapa.sugerencia)}
              disabled={loading}
              className="flex-1 rounded bg-black py-2 text-white disabled:opacity-50"
            >
              Sí, soy yo
            </button>
            <button
              onClick={() => setEtapa({ tipo: "identificar" })}
              className="flex-1 rounded border py-2"
            >
              No
            </button>
          </div>
        </div>
      )}

      {etapa.tipo === "codigo" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            verificar(etapa.empleadoId);
          }}
          className="mt-4 space-y-4"
        >
          <p className="text-sm text-neutral-500">
            Pedile el código de vinculación a tu encargado e ingresalo acá. Se
            hace una sola vez en este dispositivo.
          </p>
          <input
            required
            inputMode="numeric"
            placeholder="Código de 6 dígitos"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full rounded border px-3 py-2 text-center text-lg tracking-widest"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded bg-black py-2 text-white disabled:opacity-50"
          >
            Vincular
          </button>
        </form>
      )}

      {etapa.tipo === "marcar" && (
        <div className="mt-4 space-y-4">
          <p>
            Hola, <strong>{etapa.nombre}</strong>
          </p>
          <button
            onClick={() => marcar("entrada")}
            disabled={loading}
            className="w-full rounded bg-black py-4 text-lg text-white disabled:opacity-50"
          >
            Marcar entrada
          </button>
          <button
            onClick={() => marcar("salida")}
            disabled={loading}
            className="w-full rounded border py-4 text-lg disabled:opacity-50"
          >
            Marcar salida
          </button>
        </div>
      )}

      {mensaje && <p className="mt-4 text-green-700">{mensaje}</p>}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </div>
  );
}
