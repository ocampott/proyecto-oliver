import { useState, type FormEvent, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Loader2, Copy, Pencil, Power, Unlink, KeyRound, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Status } from "../../components/ui/status";
import { PersonCell } from "../../components/ui/avatar";
import { cn } from "../../lib/utils";
import { IconButton } from "../../components/ui/icon-button";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { Empleado } from "../../lib/api";
import { getOrgResumenActual } from "../../lib/api";
import {
  useEmpleadosPaginado,
  useCrearEmpleado,
  useEditarEmpleado,
  useEliminarEmpleado,
  useDesvincularDispositivo,
  useGenerarOtp,
} from "./hooks";
import { ErrorPlan } from "../../components/ErrorPlan";
import { useOrgActual, puedeGestionar } from "../../lib/hooks";
import { useSucursales } from "../sucursales/hooks";
import { Pagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/PageHeader";

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function minutosRestantes(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 60000));
}

function fechaLocal(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR");
}

function formatCuil(cuil: string): string {
  const digitos = cuil.replace(/\D/g, "");
  if (digitos.length !== 11) return cuil;
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}

function formatCuilInput(value: string): string {
  const digitos = value.replace(/\D/g, "").slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 10) return `${digitos.slice(0, 2)}-${digitos.slice(2)}`;
  return `${digitos.slice(0, 2)}-${digitos.slice(2, 10)}-${digitos.slice(10)}`;
}

function Celda({ value }: { value: string | null | undefined }): ReactNode {
  if (value) return <TableCell>{value}</TableCell>;
  return <TableCell className="text-center text-text-secondary">—</TableCell>;
}

type EstadoFiltro = "todos" | Empleado["estado"];
type DispositivoFiltro = "todos" | "vinculado" | "no_vinculado";
type CuilFiltro = "todos" | "con" | "sin";

const ESTADO_LABELS: Record<Empleado["estado"], string> = {
  activo: "Activo",
  de_licencia: "De licencia",
  suspendido: "Suspendido",
  baja: "Baja",
};

function nombreCompleto(emp: Empleado): string {
  return emp.apellido ? `${emp.apellido}, ${emp.nombre}` : emp.nombre;
}

export default function EmpleadosPage() {
  const navigate = useNavigate();
  const { data: org } = useOrgActual();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const crear = useCrearEmpleado();
  const editar = useEditarEmpleado();
  const eliminar = useEliminarEmpleado();
  const desvincular = useDesvincularDispositivo();
  const generarCodigo = useGenerarOtp();
  const toast = useToast();

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [celular, setCelular] = useState("");
  const [cuil, setCuil] = useState("");
  const [fechaIngreso, setFechaIngreso] = useState("");
  const [sucursalId, setSucursalId] = useState("");
  const [altaOpen, setAltaOpen] = useState(false);
  const [editando, setEditando] = useState<Empleado | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editCuil, setEditCuil] = useState("");
  const [editFechaIngreso, setEditFechaIngreso] = useState("");
  const [editSucursalId, setEditSucursalId] = useState("");
  const [editEstado, setEditEstado] = useState<Empleado["estado"]>("activo");
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [dispositivoFiltro, setDispositivoFiltro] = useState<DispositivoFiltro>("todos");
  const [sucursalFiltro, setSucursalFiltro] = useState("");
  const [cuilFiltro, setCuilFiltro] = useState<CuilFiltro>("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useEmpleadosPaginado({
    page,
    pageSize,
    q: busqueda || undefined,
    estado: estadoFiltro === "todos" ? undefined : estadoFiltro,
    sucursalId: sucursalFiltro || undefined,
    cuil: cuilFiltro === "todos" ? undefined : cuilFiltro,
    dispositivo: dispositivoFiltro === "todos" ? undefined : (dispositivoFiltro as "vinculado" | "no_vinculado"),
  });
  const empleados = data?.data ?? [];
  const [codigoDialog, setCodigoDialog] = useState<{ nombre: string; code: string } | null>(null);
  const [desvincularTarget, setDesvincularTarget] = useState<Empleado | null>(null);
  const [eliminarTarget, setEliminarTarget] = useState<Empleado | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [accionandoId, setAccionandoId] = useState<string | null>(null);

  const loading =
    crear.isPending || editar.isPending || eliminar.isPending || desvincular.isPending || generarCodigo.isPending;

  const { data: resumen } = useQuery({
    queryKey: ["org-resumen-actual"],
    queryFn: getOrgResumenActual,
  });

  const ent = org?.entitlements;
  const activosCount = resumen?.empleadosActivos ?? 0;
  const alTope = !!ent && !ent.ilimitado && ent.maxEmpleados !== null && activosCount >= ent.maxEmpleados;
  const gestionable = puedeGestionar(org ?? null);

  const filtrosActivos =
    busqueda !== "" ||
    estadoFiltro !== "todos" ||
    dispositivoFiltro !== "todos" ||
    sucursalFiltro !== "" ||
    cuilFiltro !== "todos";

  function limpiarFiltros() {
    setBusqueda("");
    setEstadoFiltro("todos");
    setDispositivoFiltro("todos");
    setSucursalFiltro("");
    setCuilFiltro("todos");
    setPage(1);
  }

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({
        nombre,
        apellido,
        celular: celular || undefined,
        cuil: cuil || undefined,
        fecha_ingreso: fechaIngreso || undefined,
        sucursal_id: sucursalId || undefined,
      });
      setNombre("");
      setApellido("");
      setCelular("");
      setCuil("");
      setFechaIngreso("");
      setSucursalId("");
      setAltaOpen(false);
      toast.success(`${apellido.trim()}, ${nombre.trim()} fue agregado a la nómina.`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  function abrirEdicion(emp: Empleado) {
    setError(null);
    setEditando(emp);
    setEditNombre(emp.nombre);
    setEditApellido(emp.apellido ?? "");
    setEditCelular(emp.celular ?? "");
    setEditCuil(emp.cuil ? formatCuilInput(emp.cuil) : "");
    setEditFechaIngreso(emp.fecha_ingreso ?? "");
    setEditSucursalId(emp.sucursal_id ?? "");
    setEditEstado(emp.estado);
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!editando) return;
    setError(null);
    try {
      await editar.mutateAsync({
        id: editando.id,
        patch: {
          nombre: editNombre,
          apellido: editApellido || undefined,
          celular: editCelular || null,
          cuil: editCuil || null,
          fecha_ingreso: editFechaIngreso || null,
          sucursal_id: editSucursalId || null,
          estado: editEstado,
        },
      });
      setEditando(null);
      toast.success("Empleado actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  async function handleCambiarEstado(emp: Empleado, nuevoEstado: Empleado["estado"]) {
    setAccionandoId(emp.id);
    try {
      await editar.mutateAsync({ id: emp.id, patch: { estado: nuevoEstado } });
      toast.success(`${nombreCompleto(emp)} pasó a estado "${ESTADO_LABELS[nuevoEstado]}".`);
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
      <PageHeader
        title="Empleados"
        actions={
          <Button
            variant="primary"
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
        }
      />

      <Toolbar>
        <Field
          label="Buscar por nombre o CUIL"
          compact
          placeholder="Buscar por nombre o CUIL"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-60"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
        <Select
          label="Sucursal"
          compact
          value={sucursalFiltro}
          onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1); }}
          options={[{ value: "", label: "Todas las sucursales" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
          containerClassName="w-44"
        />
        <Select
          label="Estado"
          compact
          value={estadoFiltro}
          onChange={(e) => { setEstadoFiltro(e.target.value as EstadoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos los estados" },
            { value: "activo", label: "Activo" },
            { value: "de_licencia", label: "De licencia" },
            { value: "suspendido", label: "Suspendido" },
            { value: "baja", label: "Baja" },
          ]}
          containerClassName="w-40"
        />
        <Select
          label="Dispositivo"
          compact
          value={dispositivoFiltro}
          onChange={(e) => { setDispositivoFiltro(e.target.value as DispositivoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Cualquier dispositivo" },
            { value: "vinculado", label: "Vinculado" },
            { value: "no_vinculado", label: "Sin vincular" },
          ]}
          containerClassName="w-40"
        />
        <Select
          label="CUIL"
          compact
          value={cuilFiltro}
          onChange={(e) => { setCuilFiltro(e.target.value as CuilFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "con", label: "Con CUIL" },
            { value: "sin", label: "Sin CUIL" },
          ]}
          containerClassName="w-36"
        />
        {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} className="ml-0" />}
        <div className="ml-auto">
          <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
        </div>
      </Toolbar>

      {error && !altaOpen && !editando && !eliminarTarget && (
        <ErrorPlan error={error} className="mt-2">
          <p className="mt-2 text-[15px] text-alert">{error.message}</p>
        </ErrorPlan>
      )}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Celular</TableHead>
            <TableHead>CUIL</TableHead>
            <TableHead>Sucursal</TableHead>
            <TableHead>Fecha de ingreso</TableHead>
            <TableHead>Dispositivo</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={8} />}
          {!isLoading &&
            empleados.map((emp) => (
              <TableRow
                key={emp.id}
                className={cn("cursor-pointer", emp.estado === "baja" && "text-text-muted")}
                onClick={() => navigate(`/empleados/${emp.id}`)}
              >
                <TableCell className="relative">
                  <PersonCell nombre={nombreCompleto(emp)} />
                  {/* Sin onClick: el click nativo del botón (mouse, Enter o
                      Espacio) burbujea al onClick de la fila. */}
                  <button
                    type="button"
                    className="absolute inset-0"
                    aria-label={`Ver detalle de ${nombreCompleto(emp)}`}
                  />
                </TableCell>
                <Celda value={emp.celular} />
                <Celda value={emp.cuil ? formatCuil(emp.cuil) : null} />
                <Celda value={sucursales.find((s) => s.id === emp.sucursal_id)?.nombre} />
                <Celda value={emp.fecha_ingreso ? fechaLocal(emp.fecha_ingreso) : null} />
                <TableCell>
                  {emp.device_token ? (
                    <Status tone="success">Vinculado</Status>
                  ) : emp.otp ? (
                    <Status tone="warning">
                      <span className="font-mono tracking-wide">{formatCode(emp.otp.code)}</span>
                      <span className="text-text-tertiary">({minutosRestantes(emp.otp.expires_at)} min)</span>
                    </Status>
                  ) : (
                    <Status tone="neutral">Sin vincular</Status>
                  )}
                </TableCell>
                <TableCell>
                  <Status tone={emp.estado === "activo" ? "success" : emp.estado === "baja" ? "neutral" : "warning"}>
                    {ESTADO_LABELS[emp.estado]}
                  </Status>
                </TableCell>
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <div className="flex justify-end gap-1.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton
                      onClick={() => abrirEdicion(emp)}
                      disabled={accionandoId === emp.id || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a editar empleados." : undefined}
                      icon={<Pencil className="h-3.5 w-3.5" />}
                      label="Editar"
                    />
                    <IconButton
                      onClick={() => handleCambiarEstado(emp, emp.estado === "baja" ? "activo" : "baja")}
                      disabled={accionandoId === emp.id || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
                      icon={
                        accionandoId === emp.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Power className="h-3.5 w-3.5" />
                        )
                      }
                      label={emp.estado === "baja" ? "Activar" : "Dar de baja"}
                    />
                    {gestionable && emp.device_token && (
                      <IconButton
                        onClick={() => setDesvincularTarget(emp)}
                        disabled={accionandoId === emp.id}
                        icon={
                          accionandoId === emp.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Unlink className="h-3.5 w-3.5" />
                          )
                        }
                        label="Desvincular"
                      />
                    )}
                    {gestionable && !emp.device_token && (
                      <IconButton
                        onClick={() => handleGenerarCodigo(emp)}
                        disabled={accionandoId === emp.id}
                        icon={
                          accionandoId === emp.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <KeyRound className="h-3.5 w-3.5" />
                          )
                        }
                        label={emp.otp ? "Código nuevo" : "Generar código"}
                      />
                    )}
                    {gestionable && emp.estado === "baja" && !emp.tiene_asistencia && (
                      <IconButton
                        onClick={() => setEliminarTarget(emp)}
                        disabled={loading}
                        icon={<Trash2 className="h-3.5 w-3.5" />}
                        label="Eliminar"
                      />
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && empleados.length === 0 && !filtrosActivos && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-text-tertiary">
                Todavía no hay empleados cargados.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && empleados.length === 0 && filtrosActivos && (
            <TableRow>
              <TableCell colSpan={8} className="py-8 text-center text-text-tertiary">
                Ningún empleado coincide con el filtro.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}

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
            label="Nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Apellido"
            required
            value={apellido}
            onChange={(e) => setApellido(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Celular (opcional)"
            value={celular}
            onChange={(e) => setCelular(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="CUIL (opcional)"
            placeholder="20-12345678-6"
            inputMode="numeric"
            maxLength={13}
            value={cuil}
            onChange={(e) => setCuil(formatCuilInput(e.target.value))}
            containerClassName="w-full"
          />
          <Field
            label="Fecha de ingreso (opcional)"
            type="date"
            value={fechaIngreso}
            onChange={(e) => setFechaIngreso(e.target.value)}
            containerClassName="w-full"
          />
          <Select
            label="Sucursal (opcional)"
            value={sucursalId}
            onChange={(e) => setSucursalId(e.target.value)}
            options={[{ value: "", label: "Sin asignar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
            containerClassName="w-full"
          />
          {error && (
            <ErrorPlan error={error}>
              <p className="text-[15px] text-alert">{error.message}</p>
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
        title={`Editar ${editando ? nombreCompleto(editando) : "empleado"}`}
      >
        <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-3">
          <Field
            label="Nombre"
            required
            value={editNombre}
            onChange={(e) => setEditNombre(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Apellido (opcional)"
            value={editApellido}
            onChange={(e) => setEditApellido(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Celular (opcional)"
            value={editCelular}
            onChange={(e) => setEditCelular(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="CUIL (opcional)"
            placeholder="20-12345678-6"
            inputMode="numeric"
            maxLength={13}
            value={editCuil}
            onChange={(e) => setEditCuil(formatCuilInput(e.target.value))}
            containerClassName="w-full"
          />
          <Field
            label="Fecha de ingreso (opcional)"
            type="date"
            value={editFechaIngreso}
            onChange={(e) => setEditFechaIngreso(e.target.value)}
            containerClassName="w-full"
          />
          <Select
            label="Sucursal (opcional)"
            value={editSucursalId}
            onChange={(e) => setEditSucursalId(e.target.value)}
            options={[{ value: "", label: "Sin asignar" }, ...sucursales.map((s) => ({ value: s.id, label: s.nombre }))]}
            containerClassName="w-full"
          />
          <Select
            label="Estado"
            value={editEstado}
            onChange={(e) => setEditEstado(e.target.value as Empleado["estado"])}
            options={[
              { value: "activo", label: "Activo" },
              { value: "de_licencia", label: "De licencia" },
              { value: "suspendido", label: "Suspendido" },
              { value: "baja", label: "Baja" },
            ]}
            containerClassName="w-full"
          />
          {error && (
            <ErrorPlan error={error}>
              <p className="text-[15px] text-alert">{error.message}</p>
            </ErrorPlan>
          )}
          <Button type="submit" variant="primary" block disabled={loading}>
            Guardar
          </Button>
        </form>
      </Dialog>

      <Dialog open={codigoDialog != null} onClose={() => setCodigoDialog(null)} title="Código de vinculación">
        <div className="mx-auto -mt-1 flex h-[52px] w-[52px] items-center justify-center rounded-[6px] bg-accent-100">
          <KeyRound className="h-[26px] w-[26px] text-accent" strokeWidth={1.8} />
        </div>
        <div className="data-number text-center text-4xl font-medium tracking-[0.14em] text-text">
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
        <p className="text-[15px] text-text-secondary">
          ¿Desvincular el dispositivo de{" "}
          <strong>{desvincularTarget ? nombreCompleto(desvincularTarget) : ""}</strong>? Va a tener que
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
        <p className="text-[15px] text-text-secondary">
          ¿Eliminar <strong>{eliminarTarget ? nombreCompleto(eliminarTarget) : ""}</strong>? Esta acción no se puede
          deshacer.
        </p>
        {error && (
          <ErrorPlan error={error}>
            <p className="text-[15px] text-alert">{error.message}</p>
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
          <Button variant="destructive" onClick={handleEliminar} disabled={loading}>
            {eliminar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Eliminar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
