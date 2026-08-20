import { useState, type FormEvent } from "react";
import { Search } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Status } from "../../components/ui/status";
import { IconButton } from "../../components/ui/icon-button";
import { Dialog } from "../../components/ui/dialog";
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

type EstadoFiltro = "todos" | "activos" | "inactivos";

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
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [codigoDialog, setCodigoDialog] = useState<{ nombre: string; code: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loading =
    crear.isPending || editar.isPending || desactivar.isPending || desvincular.isPending || generarCodigo.isPending;

  const empleadosFiltrados = empleados.filter((emp) => {
    const matchNombre = emp.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado =
      estadoFiltro === "todos" || (estadoFiltro === "activos" ? emp.activo : !emp.activo);
    return matchNombre && matchEstado;
  });

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

  async function handleGenerarCodigo(emp: Empleado) {
    setError(null);
    try {
      const otp = await generarCodigo.mutateAsync(emp.id);
      setCodigoDialog({ nombre: emp.nombre, code: formatCode(otp.code) });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Empleados</h1>

      <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Nombre y apellido"
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          containerClassName="w-[220px]"
        />
        <Field
          label="Celular (opcional)"
          value={celular}
          onChange={(e) => setCelular(e.target.value)}
          containerClassName="w-[180px]"
        />
        <Button type="submit" variant="primary" disabled={loading}>
          Agregar
        </Button>
      </form>

      {error && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Buscar"
          placeholder="Nombre del empleado"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
        <Select
          label="Estado"
          value={estadoFiltro}
          onChange={(e) => setEstadoFiltro(e.target.value as EstadoFiltro)}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activos", label: "Activos" },
            { value: "inactivos", label: "Inactivos" },
          ]}
          containerClassName="w-40"
        />
      </div>

      <Table className="mt-4">
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
            empleadosFiltrados.map((emp) => (
              <TableRow key={emp.id} className={emp.activo ? "" : "text-text/40"}>
                <TableCell>
                  {editandoId === emp.id ? (
                    <Field label="Nombre" value={editNombre} onChange={(e) => setEditNombre(e.target.value)} />
                  ) : (
                    emp.nombre
                  )}
                </TableCell>
                <TableCell>
                  {editandoId === emp.id ? (
                    <Field label="Celular" value={editCelular} onChange={(e) => setEditCelular(e.target.value)} />
                  ) : (
                    emp.celular ?? "—"
                  )}
                </TableCell>
                <TableCell>
                  {emp.device_token ? (
                    <Status tone="success">Vinculado</Status>
                  ) : emp.otp ? (
                    <span className="inline-flex items-center gap-[7px] text-[13px] text-text">
                      <span className="h-[7px] w-[7px] rounded-full bg-[--color-warning]" />
                      <span className="font-mono tracking-wide">{formatCode(emp.otp.code)}</span>
                      <span className="text-text-tertiary">({minutosRestantes(emp.otp.expires_at)} min)</span>
                    </span>
                  ) : (
                    <Status tone="neutral">Sin vincular</Status>
                  )}
                </TableCell>
                <TableCell>
                  <Status tone={emp.activo ? "success" : "neutral"}>{emp.activo ? "Activo" : "Inactivo"}</Status>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
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
                        <IconButton
                          onClick={() => {
                            setEditandoId(emp.id);
                            setEditNombre(emp.nombre);
                            setEditCelular(emp.celular ?? "");
                          }}
                          icon={
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          }
                          aria-label="Editar"
                        />
                        <IconButton
                          onClick={() => handleToggleActivo(emp)}
                          disabled={loading}
                          icon={
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2v6" />
                              <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
                            </svg>
                          }
                          aria-label={emp.activo ? "Desactivar" : "Activar"}
                        />
                        {emp.device_token ? (
                          <IconButton
                            onClick={() => handleDesvincular(emp)}
                            disabled={loading}
                            icon={
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                                <line x1="12" y1="2" x2="12" y2="12" />
                              </svg>
                            }
                            aria-label="Desvincular"
                          />
                        ) : (
                          <IconButton
                            onClick={() => handleGenerarCodigo(emp)}
                            disabled={loading}
                            icon={
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" />
                                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                              </svg>
                            }
                            aria-label={emp.otp ? "Código nuevo" : "Generar código"}
                          />
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
          {!isLoading && empleados.length > 0 && empleadosFiltrados.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">
                Ningún empleado coincide con el filtro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={codigoDialog != null} onClose={() => setCodigoDialog(null)} title="Código de vinculación">
        <div className="mx-auto -mt-1 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-accent-100">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="text-center text-[38px] font-extrabold tracking-[0.14em] text-text">
          {codigoDialog?.code}
        </div>
        <p className="text-center text-[13.5px] text-text-secondary">
          Vence en 10 minutos. Dictáselo a {codigoDialog?.nombre}.
        </p>
        <Button variant="secondary" block onClick={() => setCodigoDialog(null)}>
          Cerrar
        </Button>
      </Dialog>
    </>
  );
}
