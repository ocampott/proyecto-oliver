"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Sucursal } from "@/lib/sucursales";

interface Props {
  sucursales: Sucursal[];
  orgSlug: string;
  baseUrl: string;
}

export default function SucursalesClient({ sucursales, orgSlug, baseUrl }: Props) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radio, setRadio] = useState("100");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ nombre: "", lat: "", lon: "", radio: "100" });
  const [qrId, setQrId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function parseNumero(s: string): number | undefined {
    const n = Number(s);
    return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
  }

  async function llamar(input: RequestInfo, init?: RequestInit) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(input, init);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error ?? "Algo salió mal. Probá de nuevo.");
        return null;
      }
      return res;
    } finally {
      setLoading(false);
    }
  }

  async function handleAlta(e: React.FormEvent) {
    e.preventDefault();
    const res = await llamar("/api/sucursales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre,
        lat: parseNumero(lat),
        lon: parseNumero(lon),
        radio_metros: parseNumero(radio),
      }),
    });
    if (res) {
      setNombre("");
      setLat("");
      setLon("");
      setRadio("100");
      router.refresh();
    }
  }

  async function handleGuardarEdicion(id: string) {
    const res = await llamar(`/api/sucursales/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: edit.nombre,
        lat: parseNumero(edit.lat) ?? null,
        lon: parseNumero(edit.lon) ?? null,
        radio_metros: parseNumero(edit.radio),
      }),
    });
    if (res) {
      setEditandoId(null);
      router.refresh();
    }
  }

  async function handleToggleActiva(suc: Sucursal) {
    const res = await llamar(`/api/sucursales/${suc.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activa: !suc.activa }),
    });
    if (res) router.refresh();
  }

  const qrSucursal = sucursales.find((s) => s.id === qrId) ?? null;
  const marcarUrl = qrSucursal ? `${baseUrl}/marcar/${orgSlug}/${qrSucursal.id}` : null;

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Sucursales</h1>

      <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
        <input
          required
          placeholder="Nombre"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          placeholder="Latitud"
          value={lat}
          onChange={(e) => setLat(e.target.value)}
          className="w-32 rounded border px-3 py-2"
        />
        <input
          placeholder="Longitud"
          value={lon}
          onChange={(e) => setLon(e.target.value)}
          className="w-32 rounded border px-3 py-2"
        />
        <input
          placeholder="Radio (m)"
          value={radio}
          onChange={(e) => setRadio(e.target.value)}
          className="w-24 rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Agregar
        </button>
      </form>
      <p className="mt-1 text-sm text-neutral-500">
        Sacá las coordenadas de Google Maps: click derecho sobre el local → copiar los números.
      </p>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nombre</th>
            <th className="border-b p-2">Coordenadas</th>
            <th className="border-b p-2">Radio</th>
            <th className="border-b p-2">Activa</th>
            <th className="border-b p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {sucursales.map((suc) => (
            <tr key={suc.id} className={suc.activa ? "" : "text-neutral-400"}>
              <td className="border-b p-2">
                {editandoId === suc.id ? (
                  <input
                    value={edit.nombre}
                    onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                    className="w-full rounded border px-2 py-1"
                  />
                ) : (
                  suc.nombre
                )}
              </td>
              <td className="border-b p-2">
                {editandoId === suc.id ? (
                  <div className="flex gap-1">
                    <input
                      value={edit.lat}
                      onChange={(e) => setEdit({ ...edit, lat: e.target.value })}
                      placeholder="Lat"
                      className="w-28 rounded border px-2 py-1"
                    />
                    <input
                      value={edit.lon}
                      onChange={(e) => setEdit({ ...edit, lon: e.target.value })}
                      placeholder="Lon"
                      className="w-28 rounded border px-2 py-1"
                    />
                  </div>
                ) : suc.lat != null && suc.lon != null ? (
                  `${suc.lat}, ${suc.lon}`
                ) : (
                  "Sin configurar"
                )}
              </td>
              <td className="border-b p-2">
                {editandoId === suc.id ? (
                  <input
                    value={edit.radio}
                    onChange={(e) => setEdit({ ...edit, radio: e.target.value })}
                    className="w-20 rounded border px-2 py-1"
                  />
                ) : (
                  `${suc.radio_metros} m`
                )}
              </td>
              <td className="border-b p-2">{suc.activa ? "Sí" : "No"}</td>
              <td className="border-b p-2">
                <div className="flex flex-wrap gap-2">
                  {editandoId === suc.id ? (
                    <>
                      <button
                        onClick={() => handleGuardarEdicion(suc.id)}
                        disabled={loading}
                        className="underline disabled:opacity-50"
                      >
                        Guardar
                      </button>
                      <button onClick={() => setEditandoId(null)} className="underline">
                        Cancelar
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setEditandoId(suc.id);
                          setEdit({
                            nombre: suc.nombre,
                            lat: suc.lat?.toString() ?? "",
                            lon: suc.lon?.toString() ?? "",
                            radio: suc.radio_metros.toString(),
                          });
                        }}
                        className="underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleToggleActiva(suc)}
                        disabled={loading}
                        className="underline disabled:opacity-50"
                      >
                        {suc.activa ? "Desactivar" : "Activar"}
                      </button>
                      <button onClick={() => setQrId(suc.id)} className="underline">
                        Ver QR
                      </button>
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {sucursales.length === 0 && (
            <tr>
              <td colSpan={5} className="border-b p-2 text-neutral-500">
                Todavía no hay sucursales cargadas.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {qrSucursal && marcarUrl && (
        <div className="mt-6 max-w-md rounded-lg border p-4">
          <div className="flex items-start justify-between">
            <h2 className="text-lg font-semibold">QR — {qrSucursal.nombre}</h2>
            <button onClick={() => setQrId(null)} className="underline">
              Cerrar
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`/api/sucursales/${qrSucursal.id}/qr`}
            alt={`QR de ${qrSucursal.nombre}`}
            className="mt-2 w-full"
          />
          <p className="mt-2 break-all text-sm text-neutral-500">{marcarUrl}</p>
          <a
            href={`/api/sucursales/${qrSucursal.id}/qr`}
            download={`qr-${qrSucursal.nombre}.png`}
            className="mt-2 inline-block rounded bg-black px-4 py-2 text-white"
          >
            Descargar PNG
          </a>
        </div>
      )}
    </div>
  );
}
