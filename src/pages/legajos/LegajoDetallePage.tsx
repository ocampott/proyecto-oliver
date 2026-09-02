import { useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Loader2, Trash2, UploadCloud } from "lucide-react";
import { PageHeader } from "../../components/PageHeader";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { IconButton } from "../../components/ui/icon-button";
import { Status } from "../../components/ui/status";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
import { abrirLegajoArchivo } from "../../lib/api";
import { useLegajo, useSubirLegajoArchivo, useEliminarLegajoArchivo } from "./hooks";

function formatFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatTamanio(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LegajoDetallePage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { data, isLoading } = useLegajo(id ?? "");
  const subir = useSubirLegajoArchivo(id ?? "");
  const eliminar = useEliminarLegajoArchivo(id ?? "");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [arrastrando, setArrastrando] = useState(false);
  const [errorSubida, setErrorSubida] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState<string | null>(null);

  async function subirArchivo(file: File) {
    setErrorSubida("");
    try {
      await subir.mutateAsync(file);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setErrorSubida(err instanceof Error ? err.message : "Error al subir el archivo.");
    }
  }

  async function handleEliminar() {
    if (!confirmDelete) return;
    try {
      await eliminar.mutateAsync(confirmDelete);
      toast.success("Archivo eliminado.");
    } catch {
      toast.error("No se pudo eliminar el archivo.");
    } finally {
      setConfirmDelete(null);
    }
  }

  async function handleAbrir(archivoId: string) {
    setAbriendo(archivoId);
    try {
      await abrirLegajoArchivo(id ?? "", archivoId);
    } catch {
      toast.error("No se pudo abrir el archivo.");
    } finally {
      setAbriendo(null);
    }
  }

  if (isLoading) {
    return (
      <>
        <PageHeader breadcrumb={[{ label: "Legajos", href: "/legajos" }]} title="Cargando…" />
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <PageHeader breadcrumb={[{ label: "Legajos", href: "/legajos" }]} title="Empleado no encontrado" />
        <p className="mt-4 text-text-secondary">
          No encontramos este legajo.{" "}
          <Link to="/legajos" className="text-accent-700 hover:underline">
            Volver a Legajos
          </Link>
        </p>
      </>
    );
  }

  const { empleado, archivos } = data;
  const nombre = empleado.apellido ? `${empleado.apellido}, ${empleado.nombre}` : empleado.nombre;

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Legajos", href: "/legajos" }]}
        title={nombre}
        meta={
          <>
            {archivos.length} archivo{archivos.length === 1 ? "" : "s"} en el legajo
            {empleado.estado === "baja" && <span className="ml-2 text-warning">(empleado dado de baja)</span>}
          </>
        }
      />

      <div
        className={`rounded-[10px] border-2 border-dashed p-8 text-center transition-colors ${
          arrastrando ? "border-accent bg-accent-100" : "border-border"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setArrastrando(true);
        }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={(e) => {
          e.preventDefault();
          setArrastrando(false);
          const file = e.dataTransfer.files?.[0];
          if (file) subirArchivo(file);
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) subirArchivo(file);
          }}
        />
        <UploadCloud className="mx-auto h-6 w-6 text-text-tertiary" />
        <p className="mt-2 text-[14px] text-text-secondary">Arrastrá un archivo acá, o</p>
        <Button variant="primary" className="mt-3" onClick={() => fileInputRef.current?.click()} disabled={subir.isPending}>
          {subir.isPending ? "Subiendo…" : "Elegir archivo"}
        </Button>
        <p className="mt-2 text-[12px] text-text-tertiary">Máximo 20 MB por archivo.</p>
        {errorSubida && <p className="mt-2 text-[13px] text-alert">{errorSubida}</p>}
      </div>

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Archivo</TableHead>
            <TableHead>Origen</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead>Tamaño</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {archivos.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <button
                  onClick={() => handleAbrir(a.id)}
                  disabled={abriendo === a.id}
                  className="font-medium text-text hover:text-accent-700 hover:underline disabled:opacity-50"
                >
                  {abriendo === a.id ? "Abriendo…" : a.nombre_original}
                </button>
              </TableCell>
              <TableCell>
                {a.origen === "chat_empleado" ? <Status tone="success">Chat del empleado</Status> : <span className="text-text-secondary">Subido manualmente</span>}
              </TableCell>
              <TableCell className="text-text-secondary">{formatFecha(a.created_at)}</TableCell>
              <TableCell className="font-mono text-[12px] text-text-secondary">{formatTamanio(a.tamanio_bytes)}</TableCell>
              <TableCell className="text-right">
                <IconButton onClick={() => setConfirmDelete(a.id)} icon={<Trash2 className="h-3.5 w-3.5" />} label="Eliminar" />
              </TableCell>
            </TableRow>
          ))}
          {archivos.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-text-tertiary">
                Todavía no hay archivos en este legajo.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={confirmDelete != null} onClose={() => setConfirmDelete(null)} title="Eliminar archivo">
        <p className="text-[15px] text-text-secondary">¿Eliminar este archivo del legajo? Esta acción no se puede deshacer.</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmDelete(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleEliminar} disabled={eliminar.isPending}>
            {eliminar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Eliminar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
