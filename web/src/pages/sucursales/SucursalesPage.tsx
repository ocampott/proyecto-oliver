import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import type { Sucursal } from "../../lib/api";
import { useSucursales, useOrgActual, useCrearSucursal, useEditarSucursal, useDesactivarSucursal } from "./hooks";
import { useQrBlob } from "./useQrBlob";

interface EditState {
  nombre: string;
  lat: string;
  lon: string;
  radio: string;
}

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
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [edit, setEdit] = useState<EditState>({ nombre: "", lat: "", lon: "", radio: "100" });
  const [qrId, setQrId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const qrUrl = useQrBlob(qrId);
  const qrSucursal = sucursales.find((s) => s.id === qrId) ?? null;

  const loading = crear.isPending || editar.isPending || desactivar.isPending;

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
    <main className="p-8">
      <div className="max-w-4xl">
        <h1 className="text-[32px] font-extrabold text-text">Sucursales</h1>

        <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
          <Input required placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <Input placeholder="Latitud" value={lat} onChange={(e) => setLat(e.target.value)} className="w-32" />
          <Input placeholder="Longitud" value={lon} onChange={(e) => setLon(e.target.value)} className="w-32" />
          <Input placeholder="Radio (m)" value={radio} onChange={(e) => setRadio(e.target.value)} className="w-24" />
          <Button type="submit" variant="accent" disabled={loading}>
            Agregar
          </Button>
        </form>
        <p className="mt-1 text-[15px] text-text/60">
          Sacá las coordenadas de Google Maps: click derecho sobre el local → copiar los números.
        </p>

        {error && <p className="mt-2 text-[15px] text-accent">{error}</p>}

        <Table className="mt-6">
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Coordenadas</TableHead>
              <TableHead>Radio</TableHead>
              <TableHead>Activa</TableHead>
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
              sucursales.map((suc) => (
                <TableRow key={suc.id} className={suc.activa ? "" : "text-text/40"}>
                  <TableCell>
                    {editandoId === suc.id ? (
                      <Input value={edit.nombre} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} />
                    ) : (
                      suc.nombre
                    )}
                  </TableCell>
                  <TableCell>
                    {editandoId === suc.id ? (
                      <div className="flex gap-1">
                        <Input
                          value={edit.lat}
                          onChange={(e) => setEdit({ ...edit, lat: e.target.value })}
                          placeholder="Lat"
                          className="w-28"
                        />
                        <Input
                          value={edit.lon}
                          onChange={(e) => setEdit({ ...edit, lon: e.target.value })}
                          placeholder="Lon"
                          className="w-28"
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
                      <Input value={edit.radio} onChange={(e) => setEdit({ ...edit, radio: e.target.value })} className="w-20" />
                    ) : (
                      `${suc.radio_metros} m`
                    )}
                  </TableCell>
                  <TableCell>{suc.activa ? "Sí" : "No"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
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
                          <Button
                            variant="ghost"
                            onClick={() => {
                              setEditandoId(suc.id);
                              setEdit({
                                nombre: suc.nombre,
                                lat: suc.lat?.toString() ?? "",
                                lon: suc.lon?.toString() ?? "",
                                radio: suc.radio_metros.toString(),
                              });
                            }}
                          >
                            Editar
                          </Button>
                          <Button variant="ghost" onClick={() => handleToggleActiva(suc)} disabled={loading}>
                            {suc.activa ? "Desactivar" : "Activar"}
                          </Button>
                          <Button variant="ghost" onClick={() => setQrId(suc.id)}>
                            Ver QR
                          </Button>
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
          </TableBody>
        </Table>

        {qrSucursal && (
          <div className="mt-6 max-w-md rounded-lg border border-text/10 bg-surface p-4">
            <div className="flex items-start justify-between">
              <h2 className="text-[20px] font-extrabold text-text">QR — {qrSucursal.nombre}</h2>
              <Button variant="ghost" onClick={() => setQrId(null)}>
                Cerrar
              </Button>
            </div>
            {qrUrl ? (
              <img src={qrUrl} alt={`QR de ${qrSucursal.nombre}`} className="mt-2 w-full" />
            ) : (
              <p className="mt-2 text-[15px] text-text/60">Generando QR...</p>
            )}
            {org && (
              <p className="mt-2 break-all text-[15px] text-text/60">
                {`${window.location.origin}/marcar/${org.slug}/${qrSucursal.id}`}
              </p>
            )}
            {qrUrl && (
              <Button asChild variant="default" className="mt-2">
                <a href={qrUrl} download={`qr-${qrSucursal.nombre}.png`}>
                  Descargar PNG
                </a>
              </Button>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
