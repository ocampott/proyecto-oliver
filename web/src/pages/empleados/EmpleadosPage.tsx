import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Badge } from "../../components/ui/badge";
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
                    <Badge variant="filled">Vinculado</Badge>
                  ) : emp.otp ? (
                    <Badge variant="outline">
                      {formatCode(emp.otp.code)}{" "}
                      <span className="font-normal opacity-70">
                        ({minutosRestantes(emp.otp.expires_at)} min)
                      </span>
                    </Badge>
                  ) : (
                    <Badge variant="neutral">Sin vincular</Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={emp.activo ? "filled" : "neutral"}>{emp.activo ? "Sí" : "No"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-2">
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
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setEditandoId(emp.id);
                            setEditNombre(emp.nombre);
                            setEditCelular(emp.celular ?? "");
                          }}
                        >
                          Editar
                        </Button>
                        <Button variant="ghost" onClick={() => handleToggleActivo(emp)} disabled={loading}>
                          {emp.activo ? "Desactivar" : "Activar"}
                        </Button>
                        {emp.device_token ? (
                          <Button variant="ghost" onClick={() => handleDesvincular(emp)} disabled={loading}>
                            Desvincular
                          </Button>
                        ) : (
                          <Button variant="ghost" onClick={() => handleGenerarCodigo(emp)} disabled={loading}>
                            {emp.otp ? "Código nuevo" : "Generar código"}
                          </Button>
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
        <div className="text-center text-[40px] font-extrabold tracking-[0.15em] text-text">
          {codigoDialog?.code}
        </div>
        <p className="text-center text-[13px] text-text/85">
          Vence en 10 minutos. Dictáselo a {codigoDialog?.nombre}.
        </p>
      </Dialog>
    </>
  );
}
