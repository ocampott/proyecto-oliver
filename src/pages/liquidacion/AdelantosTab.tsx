import { useState, type FormEvent } from "react";
import { Plus, Loader2, TriangleAlert, Settings } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { StatRow, type StatRowItem } from "../../components/ui/stat-row";
import { formatMoneda, fechaLocal } from "../../lib/format";
import type { TipoTopeAdelanto } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import {
  useAdelantos,
  useTopeAdelanto,
  useCrearAdelanto,
  useBorrarAdelanto,
  useTopeAdelantoConfig,
  useActualizarTopeConfig,
} from "./adelantos-hooks";

const TIPO_TOPE_LABEL: Record<TipoTopeAdelanto, string> = {
  porcentaje: "Porcentaje del sueldo mensual",
  monto_fijo: "Monto fijo en pesos",
  sin_tope: "Sin tope",
};

function descripcionTope(tipo: TipoTopeAdelanto, valor: number): string {
  if (tipo === "sin_tope") return "Sin tope";
  if (tipo === "monto_fijo") return `Tope: ${formatMoneda(valor)} fijos por mes`;
  return `Tope: ${valor}% del sueldo mensual`;
}

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

export function AdelantosTab({ gestionable }: { gestionable: boolean }) {
  const toast = useToast();
  const { data: empleados = [] } = useEmpleados();

  const [desde, setDesde] = useState(inicioDeMesAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [empleadoFiltro, setEmpleadoFiltro] = useState("todos");

  const { data: adelantos = [], isLoading, isError } = useAdelantos({
    desde,
    hasta,
    empleadoId: empleadoFiltro === "todos" ? undefined : empleadoFiltro,
  });

  const [modalOpen, setModalOpen] = useState(false);
  const [formEmpleadoId, setFormEmpleadoId] = useState("");
  const [formFecha, setFormFecha] = useState(hoyAR());
  const [formMonto, setFormMonto] = useState("");
  const [formNota, setFormNota] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<(typeof adelantos)[number] | null>(null);

  const { data: tope } = useTopeAdelanto(formEmpleadoId, formFecha);
  const crear = useCrearAdelanto();
  const borrar = useBorrarAdelanto();

  const { data: topeConfig } = useTopeAdelantoConfig();
  const actualizarConfig = useActualizarTopeConfig();
  const [configOpen, setConfigOpen] = useState(false);
  const [configTipo, setConfigTipo] = useState<TipoTopeAdelanto>("porcentaje");
  const [configValor, setConfigValor] = useState("20");
  const [configError, setConfigError] = useState<string | null>(null);

  const total = adelantos.reduce((acc, a) => acc + a.monto, 0);
  const stats: StatRowItem[] = [
    { label: "Total del período", value: formatMoneda(total) },
    { label: "Adelantos cargados", value: adelantos.length },
    ...(topeConfig ? [{ label: "Tope configurado", value: descripcionTope(topeConfig.tipo, topeConfig.valor) }] : []),
  ];

  function abrirConfig() {
    setConfigTipo(topeConfig?.tipo ?? "porcentaje");
    setConfigValor(String(topeConfig?.valor ?? 20));
    setConfigError(null);
    setConfigOpen(true);
  }

  async function handleGuardarConfig(e: FormEvent) {
    e.preventDefault();
    setConfigError(null);
    const valor = Number(configValor);
    if (configTipo !== "sin_tope" && (!Number.isFinite(valor) || valor <= 0)) {
      setConfigError("El valor debe ser mayor a 0.");
      return;
    }
    try {
      await actualizarConfig.mutateAsync({ tipo: configTipo, valor: configTipo === "sin_tope" ? 0 : valor });
      toast.success("Tope actualizado.");
      setConfigOpen(false);
    } catch (err) {
      setConfigError(err instanceof Error ? err.message : "No se pudo guardar la configuración.");
    }
  }

  function abrirCrear() {
    setFormEmpleadoId(empleados[0]?.id ?? "");
    setFormFecha(hoyAR());
    setFormMonto("");
    setFormNota("");
    setFormError(null);
    setModalOpen(true);
  }

  async function handleCrear(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const monto = Number(formMonto);
    if (!Number.isFinite(monto) || monto <= 0) {
      setFormError("El monto debe ser mayor a 0.");
      return;
    }
    try {
      const resultado = await crear.mutateAsync({
        empleadoId: formEmpleadoId,
        fecha: formFecha,
        monto,
        nota: formNota.trim() || null,
      });
      toast.success("Adelanto cargado.");
      if (resultado.advertencia) toast.error(resultado.advertencia);
      setModalOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "No se pudo guardar el adelanto.");
    }
  }

  async function handleBorrar() {
    if (!borrarTarget) return;
    try {
      await borrar.mutateAsync(borrarTarget.id);
      toast.success("Adelanto borrado.");
      setBorrarTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el adelanto.");
    }
  }

  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <StatRow stats={stats} />
        {gestionable && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" onClick={abrirConfig}>
              <Settings className="h-4 w-4" />
              Configurar tope
            </Button>
            <Button variant="primary" onClick={abrirCrear}>
              <Plus className="h-4 w-4" />
              Nuevo adelanto
            </Button>
          </div>
        )}
      </div>

      <Toolbar>
        <Select
          label="Empleado"
          compact
          value={empleadoFiltro}
          onChange={(e) => setEmpleadoFiltro(e.target.value)}
          options={[{ value: "todos", label: "Todos" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
          containerClassName="w-40"
        />
        <div className="flex items-center gap-1.5">
          <Field label="Desde" compact type="date" value={desde} onChange={(e) => setDesde(e.target.value)} containerClassName="w-[136px]" />
          <span className="text-xs text-text-tertiary">→</span>
          <Field label="Hasta" compact type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} containerClassName="w-[136px]" />
        </div>
      </Toolbar>

      {isError && <p className="mt-2 text-[15px] text-alert">No se pudieron cargar los adelantos. Probá de nuevo.</p>}

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Fecha</TableHead>
            <TableHead>Empleado</TableHead>
            <TableHead>Nota</TableHead>
            <TableHead className="text-right">Monto</TableHead>
            <TableHead className="text-right"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={5} />}
          {!isLoading &&
            adelantos.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-mono text-xs">{fechaLocal(a.fecha)}</TableCell>
                <TableCell>{a.empleado_nombre}</TableCell>
                <TableCell className="text-text-secondary">{a.nota ?? "—"}</TableCell>
                <TableCell className="text-right font-mono font-semibold text-text">{formatMoneda(a.monto)}</TableCell>
                <TableCell className="text-right">
                  {gestionable && (
                    <Button variant="secondary" size="default" onClick={() => setBorrarTarget(a)}>
                      Borrar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && !isError && adelantos.length === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="py-8 text-center text-text-tertiary">
                No hay adelantos cargados en este rango.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog open={modalOpen} onClose={() => setModalOpen(false)} title="Nuevo adelanto">
        <form onSubmit={handleCrear} className="flex flex-col gap-3">
          <Select
            label="Empleado"
            required
            value={formEmpleadoId}
            onChange={(e) => setFormEmpleadoId(e.target.value)}
            options={empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))}
            containerClassName="w-full"
          />
          <Field
            label="Fecha"
            required
            type="date"
            value={formFecha}
            onChange={(e) => setFormFecha(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Monto"
            required
            type="number"
            min="0"
            step="0.01"
            value={formMonto}
            onChange={(e) => setFormMonto(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Nota (opcional)"
            value={formNota}
            onChange={(e) => setFormNota(e.target.value)}
            containerClassName="w-full"
          />
          {tope && tope.tipo !== "sin_tope" && tope.limite !== null && (
            <p className={`flex items-start gap-1.5 text-[13px] ${tope.excedido ? "text-alert" : "text-text-tertiary"}`}>
              {tope.excedido && <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
              Tope del mes: {formatMoneda(tope.limite)} · ya adelantado: {formatMoneda(tope.usado)} · disponible:{" "}
              {formatMoneda(Math.max(0, tope.disponible ?? 0))}
            </p>
          )}
          {tope && tope.tipo === "porcentaje" && tope.limite === null && formEmpleadoId && (
            <p className="text-[13px] text-text-tertiary">
              No se puede validar el tope para este empleado (solo aplica a empleados con sueldo mensual configurado).
            </p>
          )}
          {tope && tope.tipo === "sin_tope" && (
            <p className="text-[13px] text-text-tertiary">Esta organización no tiene tope de adelantos configurado.</p>
          )}
          {formError && <p className="text-[15px] text-alert">{formError}</p>}
          <Button type="submit" variant="primary" block disabled={crear.isPending || !formEmpleadoId}>
            {crear.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Cargar adelanto
          </Button>
        </form>
      </Dialog>

      <Dialog open={borrarTarget != null} onClose={() => setBorrarTarget(null)} title="Borrar adelanto">
        <p className="text-[15px] text-text-secondary">
          ¿Borrar el adelanto de <strong>{formatMoneda(borrarTarget?.monto ?? 0)}</strong> de{" "}
          <strong>{borrarTarget?.empleado_nombre}</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBorrarTarget(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleBorrar} disabled={borrar.isPending}>
            {borrar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Borrar
          </Button>
        </div>
      </Dialog>

      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} title="Configurar tope de adelantos">
        <form onSubmit={handleGuardarConfig} className="flex flex-col gap-3">
          <p className="-mt-1 text-[13px] text-text-secondary">
            Se usa para avisar (no bloquea) cuando un adelanto supera el tope. Aplica a toda la organización.
          </p>
          <Select
            label="Tipo de tope"
            value={configTipo}
            onChange={(e) => setConfigTipo(e.target.value as TipoTopeAdelanto)}
            options={(Object.keys(TIPO_TOPE_LABEL) as TipoTopeAdelanto[]).map((tipo) => ({ value: tipo, label: TIPO_TOPE_LABEL[tipo] }))}
            containerClassName="w-full"
          />
          {configTipo !== "sin_tope" && (
            <Field
              label={configTipo === "porcentaje" ? "Porcentaje del sueldo mensual" : "Monto fijo en pesos"}
              required
              type="number"
              min="0"
              step={configTipo === "porcentaje" ? "1" : "0.01"}
              value={configValor}
              onChange={(e) => setConfigValor(e.target.value)}
              containerClassName="w-full"
            />
          )}
          {configTipo === "porcentaje" && (
            <p className="text-[13px] text-text-tertiary">Solo aplica a empleados con sueldo mensual configurado.</p>
          )}
          {configError && <p className="text-[15px] text-alert">{configError}</p>}
          <Button type="submit" variant="primary" block disabled={actualizarConfig.isPending}>
            {actualizarConfig.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Guardar
          </Button>
        </form>
      </Dialog>
    </>
  );
}
