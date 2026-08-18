import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import type { Empleado } from "../../lib/api";
import {
  useEmpleados,
  useCrearEmpleado,
  useEditarEmpleado,
  useDesactivarEmpleado,
  useDesvincularDispositivo,
  useGenerarOtp,
} from "./hooks";

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function minutosRestantes(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

export default function EmpleadosPage() {
  const { data: empleados = [], isLoading } = useEmpleados();
  const crear = useCrearEmpleado();
  const editar = useEditarEmpleado();
  const desactivar = useDesactivarEmpleado();
  const desvincular = useDesvincularDispositivo();
  const generarCodigo = useGenerarOtp();

  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loading =
    crear.isPending || editar.isPending || desactivar.isPending || desvincular.isPending || generarCodigo.isPending;

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({ nombre, celular: celular || undefined });
      setNombre("");
      setCelular("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editar.mutateAsync({ id, patch: { nombre: editNombre, celular: editCelular || null } });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleToggleActivo(emp: Empleado) {
    setError(null);
    try {
      await editar.mutateAsync({ id: emp.id, patch: { activo: !emp.activo } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleDesvincular(emp: Empleado) {
    if (!confirm(`¿Desvincular el dispositivo de ${emp.nombre}? Va a tener que revincular con un código nuevo.`)) {
      return;
    }
    setError(null);
    try {
      await desvincular.mutateAsync(emp.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGenerarCodigo(id: string) {
    setError(null);
    try {
      await generarCodigo.mutateAsync(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  return (
    <main className="p-8">
      <div className="max-w-4xl">
        <h1 className="text-[32px] font-extrabold text-text">Empleados</h1>

        <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
          <Input required placeholder="Nombre y apellido" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input placeholder="Celular (opcional)" value={celular} onChange={(e) => setCelular(e.target.value)} />
          <Button type="submit" variant="accent" disabled={loading}>
            Agregar
          </Button>
        </form>

        {error && <p className="mt-2 text-[15px] text-accent">{error}</p>}

        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Celular</TableHead>
              <TableHead>Dispositivo</TableHead>
              <TableHead>Activo</TableHead>
              <TableHead>Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  Cargando...
                </TableCell>
              </TableRow>
            )}
            {!isLoading &&
              empleados.map((emp) => (
                <TableRow key={emp.id} className={emp.activo ? "" : "text-text/40"}>
                  <TableCell>
                    {editandoId === emp.id ? (
                      <Input value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                    ) : (
                      emp.nombre
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === emp.id ? (
                      <Input value={editCelular} onChange={(e) => setEditCelular(e.target.value)} />
                    ) : (
                      emp.celular ?? "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {emp.device_token ? (
                      "Vinculado"
                    ) : emp.otp ? (
                      <span>
                        Código: <strong className="text-[15px] tracking-wide">{formatCode(emp.otp.code)}</strong>{" "}
                        <span className="text-text/60">(vence en {minutosRestantes(emp.otp.expires_at)} min)</span>
                      </span>
                    ) : (
                      "Sin vincular"
                    )}
                  </TableCell>
                  <TableCell>{emp.activo ? "Sí" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      {editandoId === emp.id ? (
                        <>
                          <Button variant="ghost" onClick={() => handleGuardarEdicion(emp.id)} disabled={loading}>
                            Guardar
                          </Button>
                          <Button variant="ghost" onClick={() => setEditandoId(null)}>
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditandoId(emp.id);
                              setEditNombre(emp.nombre);
                              setEditCelular(emp.celular ?? "");
                            }}
                          >
                            Editar
                          </Button>
                          <Button variant="ghost" onClick={() => handleToggleActivo(emp)} disabled={loading}>
                            {emp.activo ? "Desactivar" : "Activar"}
                          </Button>
                          {emp.device_token ? (
                            <Button variant="ghost" onClick={() => handleDesvincular(emp)} disabled={loading}>
                              Desvincular
                            </Button>
                          ) : (
                            <Button variant="ghost" onClick={() => handleGenerarCodigo(emp.id)} disabled={loading}>
                              {emp.otp ? "Código nuevo" : "Generar código"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            {!isLoading && empleados.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-text/60">
                  Todavía no hay empleados cargados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}
