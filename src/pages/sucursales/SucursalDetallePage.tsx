import { useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { Pencil, Download, MapPin, Loader2 } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Dialog } from "../../components/ui/dialog";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { Status } from "../../components/ui/status";
import { Badge } from "../../components/ui/badge";
import { Card } from "../../components/ui/card";
import { PersonCell } from "../../components/ui/avatar";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import { MapaUbicacion, type Coordenadas } from "../../components/MapaUbicacion";
import { ErrorPlan } from "../../components/ErrorPlan";
import type { Sucursal } from "../../lib/api";
import { useSucursales, useOrgActual, useEditarSucursal } from "./hooks";
import { useQrBlob } from "./useQrBlob";
import { useEmpleados } from "../empleados/hooks";
import { useAsistenciaEnVivo } from "../../components/dashboard/useAsistenciaEnVivo";
import { puedeGestionar } from "../../lib/hooks";

function parseNumero(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

function coordsDe(suc: Sucursal): Coordenadas | null {
  return suc.lat != null && suc.lon != null ? { lat: suc.lat, lon: suc.lon } : null;
}

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

function estadoLabel(estado: "activo" | "de_licencia" | "suspendido" | "baja"): string {
  if (estado === "activo") return "Activo";
  if (estado === "de_licencia") return "De licencia";
  if (estado === "suspendido") return "Suspendido";
  return "Baja";
}

export default function SucursalDetallePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data: org } = useOrgActual();
  const gestionable = puedeGestionar(org ?? null);

  // ponytail: trae hasta 30 sucursales (el máximo que el backend acepta
  // por página) y busca la que corresponde — sin endpoint GET
  // /sucursales/:id dedicado, mismo patrón que Detalle de empleado. Si
  // una organización supera las 30 sucursales, esto deja de alcanzar y
  // hace falta ese endpoint dedicado.
  const { data: sucursalesData, isLoading: sucursalesLoading } = useSucursales();
  const sucursal = sucursalesData?.data.find((s) => s.id === id);

  const { data: empleados = [], isLoading: empleadosLoading } = useEmpleados();
  const plantel = empleados.filter((e) => e.sucursal_id === id && e.estado !== "baja");

  const live = useAsistenciaEnVivo(org?.id ?? "");
  const grupoAdentro = live.porSucursal.find((g) => g.sucursalId === id);
  const idsAdentro = new Set((grupoAdentro?.empleados ?? []).map((e) => e.empleadoId));
  const marcasHoy = live.registrosHoy.filter((r) => r.sucursal_id === id).length;

  const qrUrl = useQrBlob(id ?? null);

  const editar = useEditarSucursal();
  const [editOpen, setEditOpen] = useState(false);
  const [editNombre, setEditNombre] = useState("");
  const [editRadio, setEditRadio] = useState("100");
  const [editCoords, setEditCoords] = useState<Coordenadas | null>(null);
  const [editDireccion, setEditDireccion] = useState<string | null>(null);
  const [error, setError] = useState<Error | null>(null);

  function abrirEdicion() {
    if (!sucursal) return;
    setError(null);
    setEditNombre(sucursal.nombre);
    setEditRadio(sucursal.radio_metros.toString());
    setEditCoords(coordsDe(sucursal));
    setEditDireccion(sucursal.direccion);
    setEditOpen(true);
  }

  async function handleGuardarEdicion(e: FormEvent) {
    e.preventDefault();
    if (!sucursal) return;
    setError(null);
    try {
      await editar.mutateAsync({
        id: sucursal.id,
        patch: {
          nombre: editNombre,
          lat: editCoords?.lat ?? null,
          lon: editCoords?.lon ?? null,
          radio_metros: parseNumero(editRadio),
          direccion: editDireccion,
        },
      });
      setEditOpen(false);
      toast.success("Sucursal actualizada.");
    } catch (err) {
      setError(err instanceof Error ? err : new Error("Algo salió mal. Probá de nuevo."));
    }
  }

  if (sucursalesLoading || empleadosLoading) {
    return <p className="text-text-tertiary">Cargando…</p>;
  }

  if (!sucursal) {
    return (
      <>
        <PageHeader breadcrumb={[{ label: "Sucursales", href: "/sucursales" }]} title="Sucursal no encontrada" />
        <p className="mt-4 text-text-secondary">
          No encontramos esta sucursal.{" "}
          <Link to="/sucursales" className="text-accent-700 hover:underline">
            Volver a Sucursales
          </Link>
          .
        </p>
      </>
    );
  }

  const stats: StatRowItem[] = [
    { label: "Adentro ahora", value: idsAdentro.size, meta: `${plantel.length} asignados` },
    { label: "Marcas de hoy", value: marcasHoy, meta: "entradas y salidas" },
    { label: "Radio de geocerca", value: `${sucursal.radio_metros} m`, meta: "tolerancia de fichaje" },
    { label: "Alta", value: fechaLocal(sucursal.created_at) },
  ];

  const urlMarcado = org ? `${window.location.origin}/marcar/${org.slug}/${sucursal.id}` : "";

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Sucursales", href: "/sucursales" }]}
        title={sucursal.nombre}
        meta={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={sucursal.activa ? "success" : "neutral"}>{sucursal.activa ? "Activa" : "Inactiva"}</Badge>
            <span className="text-text-tertiary">{sucursal.direccion ?? "Sin dirección cargada"}</span>
          </span>
        }
        actions={
          <div className="flex gap-2">
            {qrUrl && (
              <Button variant="secondary" asChild>
                <a href={qrUrl} download={`qr-${sucursal.nombre}.png`}>
                  <Download className="h-4 w-4" />
                  Descargar QR
                </a>
              </Button>
            )}
            <Button
              variant="primary"
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

      <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <div className="min-w-0">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[14px] font-semibold text-text">Plantel asignado</h3>
              <span className="text-[12px] text-text-tertiary">{plantel.length} personas</span>
            </div>
            <Table containerClassName="mt-3">
              <TableHeader>
                <TableRow>
                  <TableHead>Empleado</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead className="text-right">Hoy</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plantel.map((emp) => (
                  <TableRow key={emp.id}>
                    <TableCell>
                      <Link to={`/empleados/${emp.id}`} className="hover:underline">
                        <PersonCell nombre={emp.apellido ? `${emp.apellido}, ${emp.nombre}` : emp.nombre} />
                      </Link>
                    </TableCell>
                    <TableCell>
                      <Status tone={emp.estado === "activo" ? "success" : emp.estado === "baja" ? "neutral" : "warning"}>
                        {estadoLabel(emp.estado)}
                      </Status>
                    </TableCell>
                    <TableCell>
                      {emp.device_token ? <Status tone="success">Vinculado</Status> : <Status tone="neutral">Sin vincular</Status>}
                    </TableCell>
                    <TableCell className="text-right">
                      {idsAdentro.has(emp.id) ? (
                        <Status tone="success">Adentro</Status>
                      ) : (
                        <span className="text-text-tertiary">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {plantel.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-text-tertiary">Todavía no hay empleados asignados a esta sucursal.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </Card>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <h3 className="text-[14px] font-semibold text-text">Marcado por QR</h3>
            <div className="mt-3 flex h-32 w-32 items-center justify-center rounded-[8px] border border-border bg-surface">
              {qrUrl ? (
                <img src={qrUrl} alt={`QR de ${sucursal.nombre}`} className="h-full w-full object-contain p-2" />
              ) : (
                <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
              )}
            </div>
            {org && <p className="mt-3 break-all font-mono text-[11px] text-text-tertiary">{urlMarcado}</p>}
            <p className="mt-2 text-[12.5px] leading-relaxed text-text-secondary">
              Imprimí el QR y pegalo en la entrada. El empleado escanea, se identifica y marca desde su propio teléfono.
            </p>
          </Card>

          <Card>
            <h3 className="text-[14px] font-semibold text-text">Ubicación y geocerca</h3>
            {sucursal.lat != null && sucursal.lon != null ? (
              <>
                <div className="relative mt-3 h-32 overflow-hidden rounded-[8px] border border-border bg-surface">
                  <div className="absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,var(--color-border)_1px,transparent_1px),linear-gradient(to_bottom,var(--color-border)_1px,transparent_1px)] [background-size:16px_16px]" />
                  <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent-300 bg-accent-100/50" />
                  <MapPin className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-accent-700" />
                </div>
                <dl className="mt-3 flex flex-col gap-2 text-[13px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-tertiary">Coordenadas</dt>
                    <dd className="font-mono text-text">{sucursal.lat.toFixed(4)}, {sucursal.lon.toFixed(4)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-text-tertiary">Radio</dt>
                    <dd className="text-text">{sucursal.radio_metros} m</dd>
                  </div>
                </dl>
              </>
            ) : (
              <p className="mt-3 text-[13px] text-warning">
                Sin ubicación cargada: las marcas de esta sucursal no se pueden validar por geocerca.
              </p>
            )}
          </Card>
        </div>
      </div>

      <Dialog
        open={editOpen}
        onClose={() => { setEditOpen(false); setError(null); }}
        title={`Editar ${sucursal.nombre}`}
        className="max-w-[560px]"
      >
        <form onSubmit={handleGuardarEdicion} className="flex flex-col gap-3">
          <Field label="Nombre" required value={editNombre} onChange={(e) => setEditNombre(e.target.value)} containerClassName="w-full" />
          <Field label="Radio (m)" value={editRadio} onChange={(e) => setEditRadio(e.target.value)} containerClassName="w-full" />
          <MapaUbicacion
            value={editCoords}
            onChange={(c, d) => { setEditCoords(c); setEditDireccion(d); }}
            radioMetros={parseNumero(editRadio)}
            direccionInicial={sucursal.direccion}
          />
          {error && (
            <ErrorPlan error={error}>
              <p className="text-[15px] text-alert">{error.message}</p>
            </ErrorPlan>
          )}
          <Button type="submit" variant="primary" block disabled={editar.isPending}>
            Guardar
          </Button>
        </form>
      </Dialog>
    </>
  );
}
