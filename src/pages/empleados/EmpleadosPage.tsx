import { useState, type FormEvent } from "react";
import { Search, Plus, Loader2, Copy } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Status } from "../../components/ui/status";
import { IconButton } from "../../components/ui/icon-button";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { Empleado } from "../../lib/api";
import {
  useEmpleados,
  useCrearEmpleado,
  useEditarEmpleado,
  useEliminarEmpleado,
  useDesvincularDispositivo,
  useGenerarOtp,
} from "./hooks";
import { ErrorPlan } from "../../components/ErrorPlan";
import { useOrgActual, puedeGestionar } from "../../lib/hooks";

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function minutosRestantes(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

type EstadoFiltro = "todos" | "activos" | "inactivos";
type DispositivoFiltro = "todos" | "vinculado" | "otp_pendiente" | "sin_vincular";

export default function EmpleadosPage() {
  const { data: empleados = [], isLoading } = useEmpleados();
  const { data: org } = useOrgActual();
  const crear = useCrearEmpleado();
  const editar = useEditarEmpleado();
  const eliminar = useEliminarEmpleado();
  const desvincular = useDesvincularDispositivo();
  const generarCodigo = useGenerarOtp();
  const toast = useToast();

  const [nombre, setNombre] = useState("");
  const [celular, setCelular] = useState("");
  const [altaOpen, setAltaOpen] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [dispositivoFiltro, setDispositivoFiltro] = useState<DispositivoFiltro>("todos");
  const [codigoDialog, setCodigoDialog] = useState<{ nombre: string; code: string } | null>(null);
  const [desvincularTarget, setDesvincularTarget] = useState<Empleado | null>(null);
  const [eliminarTarget, setEliminarTarget] = useState<Empleado | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [accionandoId, setAccionandoId] = useState<string | null>(null);

  const loading =
    crear.isPending || editar.isPending || eliminar.isPending || desvincular.isPending || generarCodigo.isPending;

  const ent = org?.entitlements;
  const activosCount = empleados.filter((e) => e.activo).length;
  const alTope = !!ent && !ent.ilimitado && ent.maxEmpleados !== null && activosCount >= ent.maxEmpleados;
  const gestionable = puedeGestionar(org ?? null);

  const empleadosFiltrados = empleados.filter((emp) => {
    const matchNombre = emp.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado =
      estadoFiltro === "todos" || (estadoFiltro === "activos" ? emp.activo : !emp.activo);
    const matchDispositivo =
      dispositivoFiltro === "todos" ||
      (dispositivoFiltro === "vinculado"
        ? !!emp.device_token
        : dispositivoFiltro === "otp_pendiente"
          ? !emp.device_token && !!emp.otp
          : !emp.device_token && !emp.otp);
    return matchNombre && matchEstado && matchDispositivo;
  });

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({ nombre, celular: celular || undefined });
      setNombre("");
      setCelular("");
      setAltaOpen(false);
      toast.success(`${nombre.trim()} fue agregado a la nómina.`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  function abrirEdicion(emp: Empleado) {
    setError(null);
    setEditando(emp);
    setEditNombre(emp.nombre);
    setEditCelular(emp.celular ?? "");
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setError(null);
    try {
      await editar.mutateAsync({ id: editando.id, patch: { nombre: editNombre, celular: editCelular || null } });
      setEditando(null);
      toast.success("Empleado actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  async function handleToggleActivo(emp: Empleado) {
    setAccionandoId(emp.id);
    try {
      await editar.mutateAsync({ id: emp.id, patch: { activo: !emp.activo } });
      toast.success(emp.activo ? `${emp.nombre} fue desactivado.` : `${emp.nombre} fue activado.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setAccionandoId(null);
    }
  }

  async function handleDesvincular() {
    if (!desvincularTarget) return;
    setAccionandoId(desvincularTarget.id);
    try {
      await desvincular.mutateAsync(desvincularTarget.id);
      toast.success(`Se desvinculó el dispositivo de ${desvincularTarget.nombre}.`);
      setDesvincularTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setAccionandoId(null);
    }
  }

  async function handleEliminar() {
    if (!eliminarTarget) return;
    setError(null);
    try {
      await eliminar.mutateAsync(eliminarTarget.id);
      toast.success("Empleado eliminado.");
      setEliminarTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  async function handleGenerarCodigo(emp: Empleado) {
    setAccionandoId(emp.id);
    try {
      const otp = await generarCodigo.mutateAsync(emp.id);
      setCodigoDialog({ nombre: emp.nombre, code: otp.code });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setAccionandoId(null);
    }
  }

  async function handleCopiarCodigo() {
    if (!codigoDialog) return;
    try {
      await navigator.clipboard.writeText(codigoDialog.code);
      toast.success("Código copiado.");
    } catch {
      toast.error("No se pudo copiar. Copialo manualmente.");
    }
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Empleados</h1>

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
        <Select
          label="Dispositivo"
          value={dispositivoFiltro}
          onChange={(e) => setDispositivoFiltro(e.target.value as DispositivoFiltro)}
          options={[
            { value: "todos", label: "Todos" },
            { value: "vinculado", label: "Vinculado" },
            { value: "otp_pendiente", label: "OTP pendiente" },
            { value: "sin_vincular", label: "Sin vincular" },
          ]}
          containerClassName="w-40"
        />
        <Button
          variant="primary"
          className="ml-auto"
          disabled={alTope || !gestionable}
          title={
            !gestionable
              ? "Tu rol no tiene acceso a crear empleados."
              : alTope
                ? `Llegaste al máximo de ${ent!.maxEmpleados} empleados de tu plan. Pasate a un plan superior para sumar más.`
                : undefined
          }
          onClick={() => {
            setError(null);
            setAltaOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nuevo empleado
        </Button>
      </div>

      {error && !altaOpen && !editando && !eliminarTarget && (
        <ErrorPlan error={error} className="mt-2">
          <p className="mt-2 text-[15px] text-accent-700">{error.message}</p>
        </ErrorPlan>
      )}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Celular</TableHead>
            <TableHead>Dispositivo</TableHead>
            <TableHead>Activo</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={5} />}
          {!isLoading &&
            empleadosFiltrados.map((emp) => (
              <TableRow key={emp.id} className={emp.activo ? "" : "text-text/40"}>
                <TableCell>{emp.nombre}</TableCell>
                <TableCell>{emp.celular ?? "—"}</TableCell>
                <TableCell>
                  {emp.device_token ? (
                    <Status tone="success">Vinculado</Status>
                  ) : emp.otp ? (
                    <span className="inline-flex items-center gap-[7px] text-[13px] text-text">
                      <span className="h-[7px] w-[7px] rounded-full bg-warning" />
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
                    <IconButton
                      onClick={() => abrirEdicion(emp)}
                      disabled={loading || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a editar empleados." : undefined}
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      }
                      label="Editar"
                    />
                    <IconButton
                      onClick={() => handleToggleActivo(emp)}
                      disabled={loading || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
                      icon={
                        accionandoId === emp.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v6" />
                            <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
                          </svg>
                        )
                      }
                      label={emp.activo ? "Desactivar" : "Activar"}
                    />
                    {gestionable && emp.device_token && (
                      <IconButton
                        onClick={() => setDesvincularTarget(emp)}
                        disabled={loading}
                        icon={
                          accionandoId === emp.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
                              <line x1="12" y1="2" x2="12" y2="12" />
                            </svg>
                          )
                        }
                        label="Desvincular"
                      />
                    )}
                    {gestionable && !emp.device_token && (
                      <IconButton
                        onClick={() => handleGenerarCodigo(emp)}
                        disabled={loading}
                        icon={
                          accionandoId === emp.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <rect x="3" y="11" width="18" height="11" rx="2" />
                              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                          )
                        }
                        label={emp.otp ? "Código nuevo" : "Generar código"}
                      />
                    )}
                    {gestionable && !emp.activo && !emp.tiene_asistencia && (
                      <IconButton
                        onClick={() => setEliminarTarget(emp)}
                        disabled={loading}
                        icon={
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18" />
                            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6" />
                            <path d="M14 11v6" />
                          </svg>
                        }
                        label="Eliminar"
                      />
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

      <Dialog
        open={altaOpen}
        onClose={() => {
          setAltaOpen(false);
          setError(null);
        }}
        title="Nuevo empleado"
      >
        <form onSubmit={handleAlta} className="flex flex-col gap-3">
          <Field
            label="Nombre y apellido"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Celular (opcional)"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            containerClassName="w-full"
          />
          {error && (
            <ErrorPlan error={error}>
              <p className="text-[15px] text-accent-700">{error.message}</p>
            </ErrorPlan>
          )}
          <Button type="submit" variant="primary" block disabled={loading}>
            Agregar
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={editando != null}
        onClose={() => {
          setEditando(null);
          setError(null);
        }}
        title={`Editar ${editando?.nombre ?? "empleado"}`}
      >
        <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-3">
          <Field
            label="Nombre y apellido"
            required
            value={editNombre}
            onChange={(e) => setEditNombre(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Celular (opcional)"
            value={editCelular}
            onChange={(e) => setEditCelular(e.target.value)}
            containerClassName="w-full"
          />
          {error && (
            <ErrorPlan error={error}>
              <p className="text-[15px] text-accent-700">{error.message}</p>
            </ErrorPlan>
          )}
          <Button type="submit" variant="primary" block disabled={loading}>
            Guardar
          </Button>
        </form>
      </Dialog>

      <Dialog open={codigoDialog != null} onClose={() => setCodigoDialog(null)} title="Código de vinculación">
        <div className="mx-auto -mt-1 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-accent-100">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-accent" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        </div>
        <div className="text-center text-[38px] font-extrabold tracking-[0.14em] text-text">
          {codigoDialog ? formatCode(codigoDialog.code) : ""}
        </div>
        <p className="text-center text-[13.5px] text-text-secondary">
          Vence en 10 minutos. Dictáselo a {codigoDialog?.nombre}, o copialo y compartíselo.
        </p>
        <Button variant="secondary" block onClick={handleCopiarCodigo}>
          <Copy className="h-4 w-4" />
          Copiar código
        </Button>
        <Button variant="ghost" block onClick={() => setCodigoDialog(null)}>
          Cerrar
        </Button>
      </Dialog>

      <Dialog
        open={desvincularTarget != null}
        onClose={() => setDesvincularTarget(null)}
        title="Desvincular dispositivo"
      >
        <p className="text-[15px] text-text/70">
          ¿Desvincular el dispositivo de <strong>{desvincularTarget?.nombre}</strong>? Va a tener que
          revincular con un código nuevo la próxima vez que quiera marcar.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setDesvincularTarget(null)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleDesvincular} disabled={desvincular.isPending}>
            {desvincular.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Desvincular
          </Button>
        </div>
      </Dialog>

      <Dialog
        open={eliminarTarget != null}
        onClose={() => {
          setEliminarTarget(null);
          setError(null);
        }}
        title="Eliminar empleado"
      >
        <p className="text-[15px] text-text/70">
          ¿Eliminar <strong>{eliminarTarget?.nombre}</strong>? Esta acción no se puede deshacer.
        </p>
        {error && (
          <ErrorPlan error={error}>
            <p className="text-[15px] text-accent-700">{error.message}</p>
          </ErrorPlan>
        )}
        <div className="flex justify-end gap-2">
          <Button
            variant="secondary"
            onClick={() => {
              setEliminarTarget(null);
              setError(null);
            }}
          >
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleEliminar} disabled={loading}>
            {eliminar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Eliminar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
