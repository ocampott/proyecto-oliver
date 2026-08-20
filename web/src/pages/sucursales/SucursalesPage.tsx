import { useState, type FormEvent } from "react";
import { Search, Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Status } from "../../components/ui/status";
import { IconButton } from "../../components/ui/icon-button";
import { Dialog } from "../../components/ui/dialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { Sucursal } from "../../lib/api";
import { useSucursales, useOrgActual, useCrearSucursal, useEditarSucursal, useDesactivarSucursal } from "./hooks";
import { useQrBlob } from "./useQrBlob";

interface EditState {
  nombre: string;
  lat: string;
  lon: string;
  radio: string;
}

type EstadoFiltro = "todos" | "activos" | "inactivos";

function parseNumero(s: string): number | undefined {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : undefined;
}

export default function SucursalesPage() {
  const { data: sucursales = [], isLoading } = useSucursales();
  const { data: org } = useOrgActual();
  const crear = useCrearSucursal();
  const editar = useEditarSucursal();
  const desactivar = useDesactivarSucursal();

  const [nombre, setNombre] = useState("");
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [radio, setRadio] = useState("100");
  const [altaOpen, setAltaOpen] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ nombre: "", lat: "", lon: "", radio: "100" });
  const [qrId, setQrId] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoFiltro>("todos");
  const [error, setError] = useState<string | null>(null);

  const qrUrl = useQrBlob(qrId);
  const qrSucursal = sucursales.find((s) => s.id === qrId) ?? null;

  const loading = crear.isPending || editar.isPending || desactivar.isPending;

  const sucursalesFiltradas = sucursales.filter((s) => {
    const matchNombre = s.nombre.toLowerCase().includes(busqueda.toLowerCase());
    const matchEstado =
      estadoFiltro === "todos" || (estadoFiltro === "activos" ? s.activa : !s.activa);
    return matchNombre && matchEstado;
  });

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await crear.mutateAsync({
        nombre,
        lat: parseNumero(lat),
        lon: parseNumero(lon),
        radio_metros: parseNumero(radio),
      });
      setNombre("");
      setLat("");
      setLon("");
      setRadio("100");
      setAltaOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleGuardarEdicion(id: string) {
    setError(null);
    try {
      await editar.mutateAsync({
        id,
        patch: {
          nombre: edit.nombre,
          lat: parseNumero(edit.lat) ?? null,
          lon: parseNumero(edit.lon) ?? null,
          radio_metros: parseNumero(edit.radio),
        },
      });
      setEditandoId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleToggleActiva(suc: Sucursal) {
    setError(null);
    try {
      await editar.mutateAsync({ id: suc.id, patch: { activa: !suc.activa } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
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
        <Button
          variant="primary"
          className="ml-auto"
          onClick={() => {
            setError(null);
            setAltaOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva sucursal
        </Button>
      </div>

      {error && !altaOpen && <p className="mt-2 text-[15px] text-accent-700">{error}</p>}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Coordenadas</TableHead>
            <TableHead>Radio</TableHead>
            <TableHead>Activa</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={5} />}
          {!isLoading &&
            sucursalesFiltradas.map((suc) => (
              <TableRow key={suc.id} className={suc.activa ? "" : "text-text/40"}>
                <TableCell>
                  {editandoId === suc.id ? (
                    <Field
                      label="Nombre"
                      value={edit.nombre}
                      onChange={(e) => setEdit({ ...edit, nombre: e.target.value })}
                    />
                  ) : (
                    suc.nombre
                  )}
                </TableCell>
                <TableCell>
                  {editandoId === suc.id ? (
                    <div className="flex gap-1">
                      <Field
                        label="Lat"
                        value={edit.lat}
                        onChange={(e) => setEdit({ ...edit, lat: e.target.value })}
                        containerClassName="w-28"
                      />
                      <Field
                        label="Lon"
                        value={edit.lon}
                        onChange={(e) => setEdit({ ...edit, lon: e.target.value })}
                        containerClassName="w-28"
                      />
                    </div>
                  ) : suc.lat != null && suc.lon != null ? (
                    `${suc.lat}, ${suc.lon}`
                  ) : (
                    "Sin configurar"
                  )}
                </TableCell>
                <TableCell>
                  {editandoId === suc.id ? (
                    <Field
                      label="Radio"
                      value={edit.radio}
                      onChange={(e) => setEdit({ ...edit, radio: e.target.value })}
                      containerClassName="w-20"
                    />
                  ) : (
                    `${suc.radio_metros} m`
                  )}
                </TableCell>
                <TableCell>
                  <Status tone={suc.activa ? "success" : "neutral"}>{suc.activa ? "Activa" : "Inactiva"}</Status>
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1.5">
                    {editandoId === suc.id ? (
                      <>
                        <Button variant="ghost" onClick={() => handleGuardarEdicion(suc.id)} disabled={loading}>
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
                            setEditandoId(suc.id);
                            setEdit({
                              nombre: suc.nombre,
                              lat: suc.lat?.toString() ?? "",
                              lon: suc.lon?.toString() ?? "",
                              radio: suc.radio_metros.toString(),
                            });
                          }}
                          icon={
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            </svg>
                          }
                          label="Editar"
                        />
                        <IconButton
                          onClick={() => handleToggleActiva(suc)}
                          disabled={loading}
                          icon={
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M12 2v6" />
                              <path d="M18.4 6.6a9 9 0 1 1-12.8 0" />
                            </svg>
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
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && sucursales.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">
                Todavía no hay sucursales cargadas.
              </TableCell>
            </TableRow>
          )}
          {!isLoading && sucursales.length > 0 && sucursalesFiltradas.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text/60">
                Ninguna sucursal coincide con el filtro.
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
        title="Nueva sucursal"
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
            label="Latitud"
            value={lat}
            onChange={(e) => setLat(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Longitud"
            value={lon}
            onChange={(e) => setLon(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Radio (m)"
            value={radio}
            onChange={(e) => setRadio(e.target.value)}
            containerClassName="w-full"
          />
          <p className="text-[13.5px] text-text/60">
            Sacá las coordenadas de Google Maps: click derecho sobre el local → copiar los números.
          </p>
          {error && <p className="text-[15px] text-accent-700">{error}</p>}
          <Button type="submit" variant="primary" block disabled={loading}>
            Agregar
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
    </>
  );
}
