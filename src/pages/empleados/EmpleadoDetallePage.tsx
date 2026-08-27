import { useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { Pencil, KeyRound, Loader2, LogIn, LogOut } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Dialog } from "../../components/ui/dialog";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { Tabs } from "../../components/ui/tabs";
import { Status } from "../../components/ui/status";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { Avatar } from "../../components/ui/avatar";
import { Meter } from "../../components/ui/meter";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import type { Empleado } from "../../lib/api";
import { horaLocal } from "../../lib/format";
import { useEmpleados, useEditarEmpleado, useGenerarOtp } from "./hooks";
import { useSucursales } from "../sucursales/hooks";
import { useHoras } from "../horas/hooks";
import { useHorarios, useCumplimiento } from "../turnos/hooks";
import { useAsistenciaPaginada } from "../asistencia/hooks";
import { useAusencias } from "../rrhh/hooks";
import { calcularHorasEsperadas, ESTADO_INFO } from "../turnos/calculos";
import { useOrgActual, puedeGestionar } from "../../lib/hooks";
import { ErrorPlan } from "../../components/ErrorPlan";

const AR_TZ = "America/Argentina/Buenos_Aires";
const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function inicioDeAnioAR(): string {
  return `${hoyAR().slice(0, 4)}-01-01`;
}

function hace30Dias(): string {
  const d = new Date();
  d.setDate(d.getDate() - 30);
  return d.toLocaleDateString("sv", { timeZone: AR_TZ });
}

function fechaLocal(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString("es-AR");
}

function diasEntre(desde: string, hasta: string): number {
  return Math.round((new Date(hasta).getTime() - new Date(desde).getTime()) / 86400000) + 1;
}

function nombreCompleto(emp: Empleado): string {
  return emp.apellido ? `${emp.apellido}, ${emp.nombre}` : emp.nombre;
}

function formatCode(code: string): string {
  return `${code.slice(0, 3)} ${code.slice(3)}`;
}

function estadoLabel(estado: Empleado["estado"]): string {
  if (estado === "activo") return "Activo";
  if (estado === "de_licencia") return "De licencia";
  if (estado === "suspendido") return "Suspendido";
  return "Baja";
}

type Vista = "resumen" | "asistencia" | "horario" | "ausencias";

export default function EmpleadoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [vista, setVista] = useState<Vista>("resumen");

  // ponytail: trae la lista completa de empleados y el mes completo de
  // turnos para mostrar uno solo — a escala PyME; si una organización
  // crece mucho, evaluar un endpoint GET /empleados/:id dedicado.
  const { data: empleados, isLoading: empleadosLoading } = useEmpleados();
  const empleado = empleados?.find((e) => e.id === id);
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const { data: org } = useOrgActual();
  const gestionable = puedeGestionar(org ?? null);

  const desde = inicioDeMesAR();
  const hasta = hoyAR();
  const { data: horasData, isError: horasError, error: horasErrorObj } = useHoras(desde, hasta);
  const { data: horarios = [] } = useHorarios(id ?? "");
  const { data: cumplimiento30 = [], isError: cumplimientoError, error: cumplimientoErrorObj } = useCumplimiento({ desde: hace30Dias(), hasta, empleadoId: id });
  const cumplimientoHoy = cumplimiento30.find((f) => f.fecha === hasta);
  const { data: ausenciasAnioData, isError: ausenciasError, error: ausenciasErrorObj } = useAusencias({ empleadoId: id, desde: inicioDeAnioAR(), hasta });
  const ausenciasAnio = ausenciasAnioData?.ausencias ?? [];
  const diasAusenciasAnio = ausenciasAnio.reduce((acc, a) => acc + diasEntre(a.fecha_desde, a.fecha_hasta), 0);

  const turnosEmpleado = (horasData?.turnos ?? []).filter((t) => t.empleado_id === id);
  const horasTrabajadas = turnosEmpleado.reduce((acc, t) => acc + (t.horas ?? 0), 0);
  const esperadas = calcularHorasEsperadas(horarios, desde, hasta);
  const extras = esperadas > 0 ? Math.max(0, horasTrabajadas - esperadas) : 0;
  const desviosCount = cumplimiento30.filter((f) => f.estado !== "a_horario" && f.estado !== "sin_horario").length;

  const [editOpen, setEditOpen] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editApellido, setEditApellido] = useState("");
  const [editCelular, setEditCelular] = useState("");
  const [editSucursalId, setEditSucursalId] = useState("");
  const [editEstado, setEditEstado] = useState<Empleado["estado"]>("activo");
  const [error, setError] = useState<string | null>(null);
  const editar = useEditarEmpleado();
  const generarCodigo = useGenerarOtp();
  const [codigoDialog, setCodigoDialog] = useState<{ code: string } | null>(null);
  const [generando, setGenerando] = useState(false);

  function abrirEdicion() {
    if (!empleado) return;
    setError(null);
    setEditNombre(empleado.nombre);
    setEditApellido(empleado.apellido ?? "");
    setEditCelular(empleado.celular ?? "");
    setEditSucursalId(empleado.sucursal_id ?? "");
    setEditEstado(empleado.estado);
    setEditOpen(true);
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!empleado) return;
    setError(null);
    try {
      await editar.mutateAsync({
        id: empleado.id,
        patch: {
          nombre: editNombre,
          apellido: editApellido || undefined,
          celular: editCelular || null,
          sucursal_id: editSucursalId || null,
          estado: editEstado,
        },
      });
      setEditOpen(false);
      toast.success("Empleado actualizado.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGenerarCodigo() {
    if (!empleado) return;
    setGenerando(true);
    try {
      const otp = await generarCodigo.mutateAsync(empleado.id);
      setCodigoDialog({ code: otp.code });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setGenerando(false);
    }
  }

  async function handleToggleEstado(nuevoEstado: Empleado["estado"]) {
    if (!empleado) return;
    try {
      await editar.mutateAsync({ id: empleado.id, patch: { estado: nuevoEstado } });
      toast.success(nuevoEstado === "activo" ? "Empleado reactivado." : "Empleado suspendido.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  if (empleadosLoading) {
    return <p className="text-text-tertiary">Cargando...</p>;
  }

  if (!empleado) {
    return (
      <>
        <PageHeader breadcrumb={[{ label: "Empleados", href: "/empleados" }]} title="Empleado no encontrado" />
        <p className="mt-4 text-text-secondary">
          No encontramos este empleado.{" "}
          <Link to="/empleados" className="text-accent-700 hover:underline">
            Volver a Empleados
          </Link>
          .
        </p>
      </>
    );
  }

  const sucursalNombre = sucursales.find((s) => s.id === empleado.sucursal_id)?.nombre;

  const stats: StatRowItem[] = [
    {
      label: "Horas del período",
      value: horasTrabajadas.toFixed(1),
      meta: esperadas > 0 ? `de ${esperadas.toFixed(1)} esperadas` : undefined,
    },
    { label: "Extras", value: extras.toFixed(1), tone: extras > 8 ? "warning" : "default" },
    {
      label: "Desvíos de turno",
      value: desviosCount,
      meta: "últimos 30 días",
      tone: desviosCount > 0 ? "warning" : "default",
    },
    { label: "Ausencias", value: ausenciasAnio.length, meta: `${diasAusenciasAnio} días en el año` },
  ];

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Empleados", href: "/empleados" }]}
        title={
          <span className="flex items-center gap-2.5">
            <Avatar nombre={nombreCompleto(empleado)} />
            {nombreCompleto(empleado)}
          </span>
        }
        meta={
          <Status tone={empleado.estado === "activo" ? "success" : empleado.estado === "baja" ? "neutral" : "warning"}>
            {estadoLabel(empleado.estado)}
          </Status>
        }
        actions={
          <div className="flex gap-2">
            {!empleado.device_token && (
              <Button
                variant="secondary"
                onClick={handleGenerarCodigo}
                disabled={generando || !gestionable}
                title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
              >
                {generando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Vincular dispositivo
              </Button>
            )}
            {empleado.estado === "activo" && (
              <Button
                variant="secondary"
                onClick={() => handleToggleEstado("suspendido")}
                disabled={editar.isPending || !gestionable}
                title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
              >
                Suspender
              </Button>
            )}
            {(empleado.estado === "suspendido" || empleado.estado === "de_licencia") && (
              <Button
                variant="secondary"
                onClick={() => handleToggleEstado("activo")}
                disabled={editar.isPending || !gestionable}
                title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
              >
                Reactivar
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={abrirEdicion}
              disabled={!gestionable}
              title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
            >
              <Pencil className="h-4 w-4" />
              Editar
            </Button>
          </div>
        }
      />

      <div className="mt-6">
        <StatRow stats={stats} />
      </div>

      {(horasError || cumplimientoError || ausenciasError) && (
        <div className="mt-2">
          <ErrorPlan error={(horasErrorObj ?? cumplimientoErrorObj ?? ausenciasErrorObj) instanceof Error ? (horasErrorObj ?? cumplimientoErrorObj ?? ausenciasErrorObj) as Error : null}>
            <p className="text-[15px] text-alert">No se pudieron cargar algunos datos de este empleado.</p>
          </ErrorPlan>
        </div>
      )}

      <div className="mt-6">
        <Tabs
          value={vista}
          onChange={setVista}
          items={[
            { value: "resumen", label: "Resumen" },
            { value: "asistencia", label: "Asistencia" },
            { value: "horario", label: "Horario" },
            { value: "ausencias", label: "Ausencias" },
          ]}
        />
      </div>

      {vista === "resumen" && (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <Card>
            <h3 className="text-[14px] font-semibold text-text">Datos personales</h3>
            <dl className="mt-3 flex flex-col gap-3 text-[13.5px]">
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">CUIL</dt>
                <dd className="text-text">{empleado.cuil ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Celular</dt>
                <dd className="text-text">{empleado.celular ?? "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Fecha de ingreso</dt>
                <dd className="text-text">{empleado.fecha_ingreso ? fechaLocal(empleado.fecha_ingreso) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-text-tertiary">Sucursal</dt>
                <dd className="text-text">{sucursalNombre ?? "—"}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-tertiary">Dispositivo</dt>
                <dd>
                  {empleado.device_token ? (
                    <Status tone="success">Vinculado</Status>
                  ) : empleado.otp ? (
                    <Status tone="warning">Código pendiente</Status>
                  ) : (
                    <Status tone="neutral">Sin vincular</Status>
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-text-tertiary">Cumplimiento de hoy</dt>
                <dd>
                  {cumplimientoHoy ? (
                    <Status tone={ESTADO_INFO[cumplimientoHoy.estado].tone}>{ESTADO_INFO[cumplimientoHoy.estado].label}</Status>
                  ) : (
                    <Status tone="neutral">Sin marcar</Status>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <Card>
            <h3 className="text-[14px] font-semibold text-text">Últimas marcas</h3>
            <ul className="mt-3 flex flex-col gap-2.5 text-[13.5px]">
              {turnosEmpleado.slice(-6).reverse().map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-1.5 text-text-secondary">
                    {t.salida_at ? <LogOut className="h-3.5 w-3.5" /> : <LogIn className="h-3.5 w-3.5" />}
                    {t.salida_at ? "Salió" : "Entró"}
                  </span>
                  <span className="font-mono text-xs text-text-tertiary">{horaLocal(t.salida_at ?? t.entrada_at)}</span>
                </li>
              ))}
              {turnosEmpleado.length === 0 && <li className="text-text-tertiary">Sin marcas en el período.</li>}
            </ul>
          </Card>
        </div>
      )}

      {vista === "asistencia" && <AsistenciaTab empleadoId={empleado.id} />}

      {vista === "horario" && (
        <div className="mt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Día</TableHead>
                <TableHead>Carga</TableHead>
                <TableHead>Horario</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Tolerancia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ORDEN_DIAS.map((d) => {
                const bloques = horarios.filter((h) => h.dia_semana === d);
                if (bloques.length === 0) {
                  return (
                    <TableRow key={d}>
                      <TableCell>{DIAS[d]}</TableCell>
                      <TableCell colSpan={4} className="text-text-tertiary">
                        Franco
                      </TableCell>
                    </TableRow>
                  );
                }
                const horasDia =
                  bloques.reduce((acc, h) => {
                    const [hI, mI] = h.hora_inicio.split(":").map(Number);
                    const [hF, mF] = h.hora_fin.split(":").map(Number);
                    return acc + Math.max(0, hF * 60 + mF - (hI * 60 + mI));
                  }, 0) / 60;
                return bloques.map((h, i) => (
                  <TableRow key={h.id}>
                    {i === 0 ? <TableCell rowSpan={bloques.length}>{DIAS[d]}</TableCell> : null}
                    {i === 0 ? (
                      <TableCell rowSpan={bloques.length}>
                        <Meter value={horasDia} max={12} />
                      </TableCell>
                    ) : null}
                    <TableCell>
                      {h.hora_inicio}–{h.hora_fin}
                    </TableCell>
                    <TableCell>{h.sucursal_nombre ?? "—"}</TableCell>
                    <TableCell>{h.tolerancia_min ?? "General"}</TableCell>
                  </TableRow>
                ));
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {vista === "ausencias" && <AusenciasTab empleadoId={empleado.id} />}

      <Dialog
        open={editOpen}
        onClose={() => {
          setEditOpen(false);
          setError(null);
        }}
        title={`Editar ${nombreCompleto(empleado)}`}
      >
        <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-3">
          <Field label="Nombre" required value={editNombre} onChange={(e) => setEditNombre(e.target.value)} containerClassName="w-full" />
          <Field label="Apellido (opcional)" value={editApellido} onChange={(e) => setEditApellido(e.target.value)} containerClassName="w-full" />
          <Field label="Celular (opcional)" value={editCelular} onChange={(e) => setEditCelular(e.target.value)} containerClassName="w-full" />
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
          {error && <p className="text-[15px] text-alert">{error}</p>}
          <Button type="submit" variant="primary" block disabled={editar.isPending}>
            Guardar
          </Button>
        </form>
      </Dialog>

      <Dialog open={codigoDialog != null} onClose={() => setCodigoDialog(null)} title="Código de vinculación">
        <div className="data-number text-center text-4xl font-medium tracking-[0.14em] text-text">
          {codigoDialog ? formatCode(codigoDialog.code) : ""}
        </div>
        <p className="text-center text-[13.5px] text-text-secondary">Vence en 10 minutos. Dictáselo a {empleado.nombre}.</p>
        <Button variant="ghost" block onClick={() => setCodigoDialog(null)}>
          Cerrar
        </Button>
      </Dialog>
    </>
  );
}

function AsistenciaTab({ empleadoId }: { empleadoId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const hoy = hoyAR();
  const desde = inicioDeAnioAR();
  const { data, isLoading } = useAsistenciaPaginada(desde, hoy, { page, pageSize, empleadoId });
  const registros = data?.data ?? [];

  return (
    <div className="mt-6">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Fecha y hora</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Sucursal</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={3} />}
          {!isLoading &&
            registros.map((r) => (
              <TableRow key={r.id}>
                <TableCell>{horaLocal(r.created_at)}</TableCell>
                <TableCell>
                  <Badge tone={r.tipo === "entrada" ? "success" : "neutral"}>
                    {r.tipo === "entrada" ? "Entrada" : "Salida"}
                  </Badge>
                </TableCell>
                <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
              </TableRow>
            ))}
          {!isLoading && registros.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="text-text-tertiary">
                Sin marcas este año.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
    </div>
  );
}

function AusenciasTab({ empleadoId }: { empleadoId: string }) {
  const { data, isLoading, isError, error } = useAusencias({ empleadoId });
  const ausencias = data?.ausencias ?? [];

  return (
    <div className="mt-6">
      {isError && (
        <ErrorPlan error={error instanceof Error ? error : null}>
          <p className="text-[15px] text-alert">No se pudieron cargar las ausencias.</p>
        </ErrorPlan>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Motivo</TableHead>
            <TableHead>Desde</TableHead>
            <TableHead>Hasta</TableHead>
            <TableHead>Certificado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={4} />}
          {!isLoading &&
            ausencias.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.motivo}</TableCell>
                <TableCell>{fechaLocal(a.fecha_desde)}</TableCell>
                <TableCell>{fechaLocal(a.fecha_hasta)}</TableCell>
                <TableCell>{a.certificado_pendiente ? <Status tone="warning">Pendiente</Status> : "—"}</TableCell>
              </TableRow>
            ))}
          {!isLoading && ausencias.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-text-tertiary">
                Sin ausencias registradas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
