"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Empleado } from "@/lib/empleados";

export interface EmpleadoConOtp extends Empleado {
  otp: { code: string; expires_at: string } | null;
}

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function minutosRestantes(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

export default function EmpleadosClient({ empleados }: { empleados: EmpleadoConOtp[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
    const res = await llamar("/api/empleados", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, celular: celular || undefined }),
    });
    if (res) {
      setNombre("");
      setCelular("");
      router.refresh();
    }
  }

  async function handleGuardarEdicion(id: string) {
    const res = await llamar(`/api/empleados/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre: editNombre, celular: editCelular || null }),
    });
    if (res) {
      setEditandoId(null);
      router.refresh();
    }
  }

  async function handleToggleActivo(emp: EmpleadoConOtp) {
    const res = await llamar(`/api/empleados/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !emp.activo }),
    });
    if (res) router.refresh();
  }

  async function handleDesvincular(emp: EmpleadoConOtp) {
    if (!confirm(`¿Desvincular el dispositivo de ${emp.nombre}? Va a tener que revincular con un código nuevo.`)) {
      return;
    }
    const res = await llamar(`/api/empleados/${emp.id}/desvincular`, { method: "POST" });
    if (res) router.refresh();
  }

  async function handleGenerarCodigo(id: string) {
    const res = await llamar(`/api/empleados/${id}/otp`, { method: "POST" });
    if (res) router.refresh();
  }

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-semibold">Empleados</h1>

      <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
        <input
          required
          placeholder="Nombre y apellido"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <input
          placeholder="Celular (opcional)"
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          className="rounded border px-3 py-2"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          Agregar
        </button>
      </form>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nombre</th>
            <th className="border-b p-2">Celular</th>
            <th className="border-b p-2">Dispositivo</th>
            <th className="border-b p-2">Activo</th>
            <th className="border-b p-2">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {empleados.map((emp) => (
            <tr key={emp.id} className={emp.activo ? "" : "text-neutral-400"}>
              <td className="border-b p-2">
                {editandoId === emp.id ? (
                  <input
                    value={editNombre}
                    onChange={(e) => setEditNombre(e.target.value)}
                    className="w-full rounded border px-2 py-1"
                  />
                ) : (
                  emp.nombre
                )}
              </td>
              <td className="border-b p-2">
                {editandoId === emp.id ? (
                  <input
                    value={editCelular}
                    onChange={(e) => setEditCelular(e.target.value)}
                    className="w-full rounded border px-2 py-1"
                  />
                ) : (
                  emp.celular ?? "—"
                )}
              </td>
              <td className="border-b p-2">
                {emp.device_token ? (
                  "Vinculado"
                ) : emp.otp ? (
                  <span>
                    Código: <strong className="text-base tracking-wide">{formatCode(emp.otp.code)}</strong>{" "}
                    <span className="text-neutral-500">(vence en {minutosRestantes(emp.otp.expires_at)} min)</span>
                  </span>
                ) : (
                  "Sin vincular"
                )}
              </td>
              <td className="border-b p-2">{emp.activo ? "Sí" : "No"}</td>
              <td className="border-b p-2">
                <div className="flex flex-wrap gap-2">
                  {editandoId === emp.id ? (
                    <>
                      <button
                        onClick={() => handleGuardarEdicion(emp.id)}
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
                          setEditandoId(emp.id);
                          setEditNombre(emp.nombre);
                          setEditCelular(emp.celular ?? "");
                        }}
                        className="underline"
                      >
                        Editar
                      </button>
                      <button onClick={() => handleToggleActivo(emp)} disabled={loading} className="underline disabled:opacity-50">
                        {emp.activo ? "Desactivar" : "Activar"}
                      </button>
                      {emp.device_token ? (
                        <button onClick={() => handleDesvincular(emp)} disabled={loading} className="underline disabled:opacity-50">
                          Desvincular
                        </button>
                      ) : (
                        <button onClick={() => handleGenerarCodigo(emp.id)} disabled={loading} className="underline disabled:opacity-50">
                          {emp.otp ? "Código nuevo" : "Generar código"}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {empleados.length === 0 && (
            <tr>
              <td colSpan={5} className="border-b p-2 text-neutral-500">
                Todavía no hay empleados cargados.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
