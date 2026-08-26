import { useState, type FormEvent } from "react";
import { Search, Plus, Loader2, X } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { FilterChip } from "../../components/ui/filter-chip";
import { Status } from "../../components/ui/status";
import { IconButton } from "../../components/ui/icon-button";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import { MapaUbicacion, type Coordenadas } from "../../components/MapaUbicacion";
import type { Sucursal } from "../../lib/api";
import { useSucursales, useOrgActual, useCrearSucursal, useEditarSucursal, useEliminarSucursal } from "./hooks";
import { useQrBlob } from "./useQrBlob";
import { ErrorPlan } from "../../components/ErrorPlan";
import { puedeGestionar } from "../../lib/hooks";

type EstadoFiltro = "todos" | "activos" | "inactivos";

function parseNumero(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

function coordsDe(suc: Sucursal): Coordenadas | null {
  return suc.lat != null && suc.lon != null ? { lat: suc.lat, lon: suc.lon } : null;
}

export default function SucursalesPage() {
  const { data: org } = useOrgActual();
  const crear = useCrearSucursal();
  const editar = useEditarSucursal();
  const eliminar = useEliminarSucursal();
  const toast = useToast();

  const [nombre, setNombre] = useState("");
  const [radio, setRadio] = useState("100");
  const [coords, setCoords] = useState<Coordenadas | null>(null);
  const [direccion, setDireccion] = useState<string | null>(null);
  const [altaOpen, setAltaOpen] = useState(false);
  const [editando, setEditando] = useState<Sucursal | null>(null);
  const [editNombre, setEditNombre] = useState("");
  const [editRadio, setEditRadio] = useState("100");
  const [editCoords, setEditCoords] = useState<Coordenadas | null>(null);
  const [editDireccion, setEditDireccion] = useState<string | null>(null);
  const [qrId, setQrId] = useState<string | null>(null);
  const [eliminarTarget, setEliminarTarget] = useState<Sucursal | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const { data, isLoading } = useSucursales({
    page,
    pageSize,
    q: busqueda || undefined,
    estado: estadoFiltro === "todos" ? undefined : estadoFiltro,
  });
  const sucursales = data?.data ?? [];
  const [error, setError] = useState<Error | null>(null);
  const [accionandoId, setAccionandoId] = useState<string | null>(null);

  const qrUrl = useQrBlob(qrId);
  const qrSucursal = sucursales.find((s) => s.id === qrId) ?? null;

  const loading = crear.isPending || editar.isPending || eliminar.isPending;

  const ent = org?.entitlements;
  const activasCount = sucursales.filter((s) => s.activa).length;
  const alTope = !!ent && !ent.ilimitado && ent.maxSucursales !== null && activasCount >= ent.maxSucursales;
  const gestionable = puedeGestionar(org ?? null);

  const filtrosActivos = busqueda !== "" || estadoFiltro !== "todos";

  function limpiarFiltros() {
    setBusqueda("");
    setEstadoFiltro("todos");
    setPage(1);
  }

  function resetAlta() {
    setNombre("");
    setRadio("100");
    setCoords(null);
    setDireccion(null);
  }

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({
        nombre,
        lat: coords?.lat,
        lon: coords?.lon,
        radio_metros: parseNumero(radio),
        direccion: direccion ?? undefined,
      });
      resetAlta();
      setAltaOpen(false);
      toast.success(`${nombre.trim()} fue agregada.`);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  function abrirEdicion(suc: Sucursal) {
    setError(null);
    setEditando(suc);
    setEditNombre(suc.nombre);
    setEditRadio(suc.radio_metros.toString());
    setEditCoords(coordsDe(suc));
    setEditDireccion(suc.direccion);
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
          lat: editCoords?.lat ?? null,
          lon: editCoords?.lon ?? null,
          radio_metros: parseNumero(editRadio),
          direccion: editDireccion,
        },
      });
      setEditando(null);
      toast.success("Sucursal actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  async function handleToggleActiva(suc: Sucursal) {
    setAccionandoId(suc.id);
    try {
      await editar.mutateAsync({ id: suc.id, patch: { activa: !suc.activa } });
      toast.success(suc.activa ? `${suc.nombre} fue desactivada.` : `${suc.nombre} fue activada.`);
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
      toast.success("Sucursal eliminada.");
      setEliminarTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Sucursales</h1>

      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Buscar"
          placeholder="Nombre de la sucursal"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
        <Button
          variant="primary"
          className="ml-auto"
          disabled={alTope || !gestionable}
          title={
            !gestionable
              ? "Tu rol no tiene acceso a crear sucursales."
              : alTope
                ? `Llegaste al máximo de ${ent!.maxSucursales} sucursales de tu plan. Pasate a un plan superior para sumar más.`
                : undefined
          }
          onClick={() => {
            setError(null);
            setAltaOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva sucursal
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <FilterChip
          label="Estado"
          value={estadoFiltro}
          defaultValue="todos"
          onChange={(v) => { setEstadoFiltro(v as EstadoFiltro); setPage(1); }}
          options={[
            { value: "todos", label: "Todos" },
            { value: "activos", label: "Activos" },
            { value: "inactivos", label: "Inactivos" },
          ]}
        />
        {filtrosActivos && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-text-secondary hover:text-text"
          >
            <X className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        )}
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
            <TableHead>Dirección</TableHead>
            <TableHead>Coordenadas</TableHead>
            <TableHead>Radio</TableHead>
            <TableHead>Activa</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            sucursales.map((suc) => (
              <TableRow key={suc.id} className={suc.activa ? "" : "text-text/40"}>
                <TableCell>{suc.nombre}</TableCell>
                <TableCell>{suc.direccion ?? "—"}</TableCell>
                <TableCell>
                  {suc.lat != null && suc.lon != null ? `${suc.lat}, ${suc.lon}` : "Sin configurar"}
                </TableCell>
                <TableCell>{`${suc.radio_metros} m`}</TableCell>
                <TableCell>
                  <Status tone={suc.activa ? "success" : "neutral"}>{suc.activa ? "Activa" : "Inactiva"}</Status>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    <IconButton
                      onClick={() => abrirEdicion(suc)}
                      disabled={!gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a editar sucursales." : undefined}
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                        </svg>
                      }
                      label="Editar"
                    />
                    <IconButton
                      onClick={() => handleToggleActiva(suc)}
                      disabled={loading || !gestionable}
                      title={!gestionable ? "Tu rol no tiene acceso a esta acción." : undefined}
                      icon={
                        accionandoId === suc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2v6" />
                            <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
                          </svg>
                        )
                      }
                      label={suc.activa ? "Desactivar" : "Activar"}
                    />
                    <IconButton
                      onClick={() => setQrId(suc.id)}
                      icon={
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <rect x="3" y="3" width="7" height="7" />
                          <rect x="14" y="3" width="7" height="7" />
                          <rect x="3" y="14" width="7" height="7" />
                          <path d="M14 14h3v3" />
                          <path d="M14 21h7v-4" />
                          <path d="M21 14v3" />
                        </svg>
                      }
                      label="Ver QR"
                    />
                    {gestionable && !suc.activa && !suc.tiene_asistencia && (
                      <IconButton
                        onClick={() => setEliminarTarget(suc)}
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
          {!isLoading && sucursales.length === 0 && !filtrosActivos && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">
                Todavía no hay sucursales cargadas.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && sucursales.length === 0 && filtrosActivos && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">
                Ninguna sucursal coincide con el filtro.
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
          resetAlta();
          setError(null);
        }}
        title="Nueva sucursal"
        className="max-w-[560px]"
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
            label="Radio (m)"
            value={radio}
            onChange={(e) => setRadio(e.target.value)}
            containerClassName="w-full"
          />
          <MapaUbicacion
            value={coords}
            onChange={(c, d) => {
              setCoords(c);
              setDireccion(d);
            }}
            radioMetros={parseNumero(radio)}
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
        title={`Editar ${editando?.nombre ?? "sucursal"}`}
        className="max-w-[560px]"
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
            label="Radio (m)"
            value={editRadio}
            onChange={(e) => setEditRadio(e.target.value)}
            containerClassName="w-full"
          />
          <MapaUbicacion
            value={editCoords}
            onChange={(c, d) => {
              setEditCoords(c);
              setEditDireccion(d);
            }}
            radioMetros={parseNumero(editRadio)}
            direccionInicial={editando?.direccion ?? null}
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

      <Dialog open={qrSucursal != null} onClose={() => setQrId(null)} title={qrSucursal?.nombre ?? ""}>
        <p className="m-0 -mt-2 text-[11.5px] font-semibold uppercase tracking-wide text-text-tertiary">Código QR</p>
        {qrUrl ? (
          <img src={qrUrl} alt={`QR de ${qrSucursal?.nombre}`} className="w-full" />
        ) : (
          <p className="text-[15px] text-text/60">Generando QR...</p>
        )}
        {org && qrSucursal && (
          <p className="break-all text-[15px] text-text/60">
            {`${window.location.origin}/marcar/${org.slug}/${qrSucursal.id}`}
          </p>
        )}
        {qrUrl && (
          <Button asChild variant="primary" block>
            <a href={qrUrl} download={`qr-${qrSucursal?.nombre}.png`}>
              Descargar PNG
            </a>
          </Button>
        )}
      </Dialog>

      <Dialog
        open={eliminarTarget != null}
        onClose={() => {
          setEliminarTarget(null);
          setError(null);
        }}
        title="Eliminar sucursal"
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
