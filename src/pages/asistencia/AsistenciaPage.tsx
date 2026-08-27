import { useState, useMemo, Fragment } from "react";
import { LogIn, LogOut, Download, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { Tabs } from "../../components/ui/tabs";
import { SidePanel } from "../../components/ui/side-panel";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { AsistenciaRegistro, TipoMarca } from "../../lib/api";
import { useAsistenciaPaginada, useRechazadas, useBorrarAsistencia, useResolverRechazada } from "./hooks";
import { horaLocal, fechaLocal, MOTIVOS_RECHAZO } from "./format";
import { Pagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/PageHeader";
import { exportarAsistencia } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { useEntitlements, useOrgActual, tieneModulo, puedeGestionar } from "../../lib/hooks";

type TipoFiltro = "todos" | TipoMarca;
type Vista = "registros" | "rechazadas";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
}

function agruparPorFecha(registros: AsistenciaRegistro[]): { fecha: string; registros: AsistenciaRegistro[] }[] {
  const grupos: { fecha: string; registros: AsistenciaRegistro[] }[] = [];
  for (const r of registros) {
    const fecha = fechaLocal(r.created_at);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.fecha === fecha) {
      ultimo.registros.push(r);
    } else {
      grupos.push({ fecha, registros: [r] });
    }
  }
  return grupos;
}

export default function AsistenciaPage() {
  const [vista, setVista] = useState<Vista>("registros");
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [empleadoFiltro, setEmpleadoFiltro] = useState("todos");
  const [sucursalFiltro, setSucursalFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [rechazadasPage, setRechazadasPage] = useState(1);
  const [rechazadasPageSize, setRechazadasPageSize] = useState(20);
  const [detalle, setDetalle] = useState<AsistenciaRegistro | null>(null);

  const { data, isLoading, isError } = useAsistenciaPaginada(desde, hasta, {
    page,
    pageSize,
    empleadoId: empleadoFiltro === "todos" ? undefined : empleadoFiltro,
    sucursalId: sucursalFiltro === "todos" ? undefined : sucursalFiltro,
    tipo: tipoFiltro === "todos" ? undefined : tipoFiltro,
  });
  const registros = data?.data ?? [];
  const grupos = useMemo(() => agruparPorFecha(registros), [registros]);
  const { data: rechazadasData } = useRechazadas({ page: rechazadasPage, pageSize: rechazadasPageSize });
  const rechazadas = rechazadasData?.data ?? [];
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const borrar = useBorrarAsistencia();
  const resolver = useResolverRechazada();
  const toast = useToast();
  const ent = useEntitlements();
  const sinReportes = !tieneModulo(ent, "reportes");
  const { data: org } = useOrgActual();
  const gestionable = puedeGestionar(org ?? null);
  const [descargando, setDescargando] = useState(false);
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<AsistenciaRegistro | null>(null);

  const filtrosActivos = empleadoFiltro !== "todos" || sucursalFiltro !== "todos" || tipoFiltro !== "todos";

  function limpiarFiltros() {
    setEmpleadoFiltro("todos");
    setSucursalFiltro("todos");
    setTipoFiltro("todos");
    setPage(1);
  }

  async function handleDescargarExcel() {
    setDescargando(true);
    try {
      await exportarAsistencia(desde, hasta);
      toast.success("Excel descargado.");
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  async function handleBorrar() {
    if (!borrarTarget) return;
    try {
      await borrar.mutateAsync(borrarTarget.id);
      toast.success("Registro borrado.");
      setBorrarTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el registro.");
    }
  }

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    setResolviendoId(id);
    try {
      await resolver.mutateAsync({ id, accion });
      toast.success(accion === "aprobar" ? "Intento aprobado." : "Intento descartado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo resolver el intento.");
    } finally {
      setResolviendoId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Asistencia"
        actions={
          <Button
            variant="secondary"
            onClick={handleDescargarExcel}
            disabled={descargando || sinReportes || !gestionable}
            title={
              !gestionable
                ? "Tu rol no tiene acceso a exportar."
                : sinReportes
                  ? "Exportar es una función del plan Básico. Pasate a un plan superior para usarla."
                  : undefined
            }
          >
            <Download className="h-4 w-4" />
            {descargando ? "Generando…" : "Descargar Excel"}
          </Button>
        }
      />

      <div className="mt-6">
        <Tabs
          value={vista}
          onChange={setVista}
          items={[
            { value: "registros", label: "Registros" },
            { value: "rechazadas", label: "Rechazadas", count: rechazadasData?.pagination.total },
          ]}
        />
      </div>

      {vista === "registros" && (
        <section className="page-section">
          <Toolbar>
            <Field
              label="Desde"
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setPage(1); }}
              containerClassName="w-40"
            />
            <Field
              label="Hasta"
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setPage(1); }}
              containerClassName="w-40"
            />
            <Select
              label="Empleado"
              value={empleadoFiltro}
              onChange={(e) => { setEmpleadoFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
              containerClassName="w-44"
            />
            <Select
              label="Sucursal"
              value={sucursalFiltro}
              onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...sucursales.map((suc) => ({ value: suc.id, label: suc.nombre }))]}
              containerClassName="w-44"
            />
            <Select
              label="Tipo"
              value={tipoFiltro}
              onChange={(e) => { setTipoFiltro(e.target.value as TipoFiltro); setPage(1); }}
              options={[
                { value: "todos", label: "Todos" },
                { value: "entrada", label: "Entrada" },
                { value: "salida", label: "Salida" },
              ]}
              containerClassName="w-36"
            />
            <div className="ml-auto flex items-center gap-3">
              {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
              <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
            </div>
          </Toolbar>

          {isError && <p className="mt-2 text-[15px] text-alert">No se pudieron cargar los registros. Probá de nuevo.</p>}

          <Table containerClassName="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableSkeleton cols={5} />}
              {!isLoading &&
                grupos.map((grupo) => (
                  <Fragment key={grupo.fecha}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="border-b-0 bg-surface py-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary"
                      >
                        {grupo.fecha}
                      </TableCell>
                    </TableRow>
                    {grupo.registros.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetalle(r)}>
                        <TableCell>{horaLocal(r.created_at)}</TableCell>
                        <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                        <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                        <TableCell>
                          {r.tipo === "entrada" ? (
                            <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-success-700">
                              <LogIn className="h-3 w-3" /> Entrada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-text-secondary">
                              <LogOut className="h-3 w-3" /> Salida
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            {gestionable && (
                              <Button
                                variant="secondary"
                                size="default"
                                onClick={(e) => { e.stopPropagation(); setBorrarTarget(r); }}
                              >
                                Borrar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              {!isLoading && registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-text-tertiary">
                    No hay registros en este rango.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
        </section>
      )}

      {vista === "rechazadas" && (
        <section className="page-section">
          <Table containerClassName="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rechazadas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{horaLocal(r.created_at)}</TableCell>
                  <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                  <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>
                    {MOTIVOS_RECHAZO[r.motivo] ?? r.motivo}
                    {r.motivo === "fuera_de_rango" && r.distancia_metros != null && (
                      <span className="text-text-tertiary"> (a {r.distancia_metros} m)</span>
                    )}
                    {r.tipo && <span className="text-text-tertiary"> — {r.tipo}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="default"
                        onClick={() => handleResolver(r.id, "aprobar")}
                        disabled={resolviendoId === r.id}
                      >
                        {resolviendoId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Aprobar
                      </Button>
                      <Button
                        variant="secondary"
                        size="default"
                        onClick={() => handleResolver(r.id, "descartar")}
                        disabled={resolviendoId === r.id}
                      >
                        Descartar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rechazadas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-text-tertiary">
                    No hay marcas rechazadas pendientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rechazadasData && (
            <Pagination
              pagination={rechazadasData.pagination}
              onPageChange={setRechazadasPage}
              onPageSizeChange={(s) => { setRechazadasPageSize(s); setRechazadasPage(1); }}
            />
          )}
        </section>
      )}

      <SidePanel
        open={detalle != null}
        onClose={() => setDetalle(null)}
        title="Detalle de marca"
        footer={
          gestionable && detalle ? (
            <Button
              variant="secondary"
              block
              onClick={() => {
                setBorrarTarget(detalle);
                setDetalle(null);
              }}
            >
              Borrar registro
            </Button>
          ) : undefined
        }
      >
        {detalle && (
          <dl className="flex flex-col gap-4 text-[13.5px]">
            <div>
              <dt className="text-text-tertiary">Empleado</dt>
              <dd className="font-medium text-text">{detalle.empleado_nombre ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Sucursal</dt>
              <dd className="font-medium text-text">{detalle.sucursal_nombre ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Tipo</dt>
              <dd className="font-medium text-text">{detalle.tipo === "entrada" ? "Entrada" : "Salida"}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Fecha y hora</dt>
              <dd className="font-medium text-text">{horaLocal(detalle.created_at)}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Ubicación registrada</dt>
              <dd className="font-mono text-text-secondary">
                {detalle.lat.toFixed(5)}, {detalle.lon.toFixed(5)}
              </dd>
            </div>
          </dl>
        )}
      </SidePanel>

      <Dialog open={borrarTarget != null} onClose={() => setBorrarTarget(null)} title="Borrar registro">
        <p className="text-[15px] text-text-secondary">
          ¿Borrar el registro de {borrarTarget?.tipo === "entrada" ? "entrada" : "salida"} de{" "}
          <strong>{borrarTarget?.empleado_nombre ?? "este empleado"}</strong> del{" "}
          {borrarTarget ? horaLocal(borrarTarget.created_at) : ""}? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBorrarTarget(null)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleBorrar} disabled={borrar.isPending}>
            {borrar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Borrar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
