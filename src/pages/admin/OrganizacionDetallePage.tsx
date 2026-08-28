import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Plus } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import { Badge } from "../../components/ui/badge";
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
import { PersonCell } from "../../components/ui/avatar";
import { PageHeader } from "../../components/PageHeader";
import { Status } from "../../components/ui/status";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import { getPlanes, type EstadoEmpleado, type OrgRole, type SuscripcionAdmin, type PlanesResponse } from "../../lib/api";
import {
  useOrganizacionAdmin,
  useMiembrosAdminOrg,
  useEmpleadosAdminOrg,
  useSucursalesAdminOrg,
  useSuscripcionesAdmin,
  useCrearSuscripcionAdmin,
  useCancelarSuscripcionAdmin,
} from "./hooks";

const ROL_LABEL: Record<OrgRole, string> = {
  owner: "Dueño",
  admin: "Admin",
  agent: "Agente",
};

const ESTADO_LABEL: Record<EstadoEmpleado, string> = {
  activo: "Activo",
  de_licencia: "De licencia",
  suspendido: "Suspendido",
  baja: "Baja",
};

const ESTADO_TONE: Record<EstadoEmpleado, "success" | "warning" | "neutral"> = {
  activo: "success",
  de_licencia: "warning",
  suspendido: "warning",
  baja: "neutral",
};

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

function precioFormateado(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

function nombreCompleto(e: { nombre: string; apellido: string | null }): string {
  return e.apellido ? `${e.apellido}, ${e.nombre}` : e.nombre;
}

type Tab = "miembros" | "empleados" | "sucursales" | "suscripcion";

export default function OrganizacionDetallePage() {
  const { id } = useParams<{ id: string }>();
  const orgId = id!;
  const [tab, setTab] = useState<Tab>("miembros");

  const { data: org } = useOrganizacionAdmin(orgId);

  return (
    <>
      <PageHeader
        breadcrumb={[{ label: "Organizaciones", href: "/admin" }]}
        title={org?.name ?? "Organización"}
      />

      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "miembros", label: "Miembros" },
            { value: "empleados", label: "Empleados" },
            { value: "sucursales", label: "Sucursales" },
            { value: "suscripcion", label: "Suscripción" },
          ]}
        />
      </div>

      {tab === "miembros" && (
        <div {...tabPanelProps("miembros")}>
          <MiembrosTab orgId={orgId} />
        </div>
      )}
      {tab === "empleados" && (
        <div {...tabPanelProps("empleados")}>
          <EmpleadosTab orgId={orgId} />
        </div>
      )}
      {tab === "sucursales" && (
        <div {...tabPanelProps("sucursales")}>
          <SucursalesTab orgId={orgId} />
        </div>
      )}
      {tab === "suscripcion" && org && (
        <div {...tabPanelProps("suscripcion")}>
          <SuscripcionTab orgId={orgId} orgName={org.name} />
        </div>
      )}
    </>
  );
}

function MiembrosTab({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading } = useMiembrosAdminOrg(orgId, { page, pageSize });
  const miembros = data?.data ?? [];

  return (
    <>
    <Table containerClassName="mt-4">
      <TableHeader>
        <TableRow>
          <TableHead>Email</TableHead>
          <TableHead>Rol</TableHead>
          <TableHead>Alta</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && <TableSkeleton cols={3} />}
        {!isLoading &&
          miembros.map((m) => (
            <TableRow key={m.userId}>
              <TableCell>{m.email}</TableCell>
              <TableCell>
                <Badge variant={m.role === "owner" ? "accent" : "neutral"}>{ROL_LABEL[m.role]}</Badge>
              </TableCell>
              <TableCell>{fechaLocal(m.createdAt)}</TableCell>
            </TableRow>
          ))}
        {!isLoading && miembros.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="text-text-tertiary">
              Esta organización no tiene miembros.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
    </>
  );
}

function EmpleadosTab({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading } = useEmpleadosAdminOrg(orgId, { page, pageSize });
  const empleados = data?.data ?? [];

  return (
    <>
    <Table containerClassName="mt-4">
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Celular</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && <TableSkeleton cols={3} />}
        {!isLoading &&
          empleados.map((e) => (
            <TableRow key={e.id}>
              <TableCell>
                <PersonCell nombre={nombreCompleto(e)} />
              </TableCell>
              <TableCell>{e.celular ?? "—"}</TableCell>
              <TableCell>
                <Status tone={ESTADO_TONE[e.estado]}>{ESTADO_LABEL[e.estado]}</Status>
              </TableCell>
            </TableRow>
          ))}
        {!isLoading && empleados.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="text-text-tertiary">
              Esta organización no tiene empleados cargados.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
    </>
  );
}

function SucursalesTab({ orgId }: { orgId: string }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading } = useSucursalesAdminOrg(orgId, { page, pageSize });
  const sucursales = data?.data ?? [];

  return (
    <>
    <Table containerClassName="mt-4">
      <TableHeader>
        <TableRow>
          <TableHead>Nombre</TableHead>
          <TableHead>Dirección</TableHead>
          <TableHead>Estado</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {isLoading && <TableSkeleton cols={3} />}
        {!isLoading &&
          sucursales.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.nombre}</TableCell>
              <TableCell>{s.direccion ?? "—"}</TableCell>
              <TableCell>
                <Badge tone={s.activa ? "success" : "neutral"}>{s.activa ? "Activa" : "Inactiva"}</Badge>
              </TableCell>
            </TableRow>
          ))}
        {!isLoading && sucursales.length === 0 && (
          <TableRow>
            <TableCell colSpan={3} className="text-text-tertiary">
              Esta organización no tiene sucursales cargadas.
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
    {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
    </>
  );
}

function SuscripcionTab({ orgId, orgName }: { orgId: string; orgName: string }) {
  const { data: catalogo } = useQuery({ queryKey: ["planes"], queryFn: getPlanes });
  const { data: suscripcionesData, isLoading: suscripcionesLoading } = useSuscripcionesAdmin(orgId);
  const crear = useCrearSuscripcionAdmin(orgId);
  const cancelar = useCancelarSuscripcionAdmin(orgId);
  const toast = useToast();

  const planes = catalogo?.planes ?? [];
  const [registrarOpen, setRegistrarOpen] = useState(false);
  const [plan, setPlan] = useState<"basico" | "pro">("basico");
  const [periodo, setPeriodo] = useState<string>("1");
  const [precio, setPrecio] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const planDef = planes.find((p: PlanesResponse["planes"][number]) => p.slug === plan);
  const periodoDef = planDef?.precios.find((p) => p.meses === Number(periodo));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const precioNum = precio.trim() === "" ? undefined : Number(precio);
    try {
      await crear.mutateAsync({
        plan,
        periodoMeses: Number(periodo),
        precioTotal: precioNum,
        notas: notas.trim() || undefined,
      });
      setNotas("");
      setPrecio("");
      setRegistrarOpen(false);
      toast.success("Suscripción registrada.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleCancelar(suscripcion: SuscripcionAdmin) {
    if (!confirm(`¿Cancelar esta suscripción? ${orgName} volverá al plan Gratis.`)) return;
    try {
      await cancelar.mutateAsync(suscripcion.id);
      toast.success("Suscripción cancelada.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar la suscripción.");
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-end gap-2">
        <Button variant="primary" className="ml-auto" onClick={() => { setFormError(null); setRegistrarOpen(true); }}>
          <Plus className="h-4 w-4" />
          Registrar suscripción
        </Button>
      </div>

      <Dialog
        open={registrarOpen}
        onClose={() => { setRegistrarOpen(false); setFormError(null); }}
        title={`Suscripción: ${orgName}`}
      >
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Select
              label="Plan"
              value={plan}
              onChange={(e) => setPlan(e.target.value as "basico" | "pro")}
              options={[
                { value: "basico", label: "Básico" },
                { value: "pro", label: "Pro" },
              ]}
            />
            <Select
              label="Período"
              value={periodo}
              onChange={(e) => setPeriodo(e.target.value)}
              options={[
                { value: "1", label: "1 mes" },
                { value: "3", label: "3 meses (-10%)" },
                { value: "12", label: "12 meses (-20%)" },
              ]}
            />
          </div>

          {periodoDef && (
            <p className="text-[14px] text-text-secondary">
              Precio calculado: <span className="font-semibold text-text">{precioFormateado(periodoDef.precioTotal)}</span>
            </p>
          )}

          <Field
            label="Precio total (opcional)"
            type="number"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder={periodoDef ? periodoDef.precioTotal.toString() : ""}
          />

          <Field
            label="Notas"
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            placeholder="Ej.: pagó por transferencia"
          />

          {formError && <p className="text-[15px] text-alert">{formError}</p>}

          <Button type="submit" variant="primary" block disabled={crear.isPending}>
            {crear.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Registrar suscripción
          </Button>
        </form>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Plan</TableHead>
            <TableHead>Período</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suscripcionesLoading && <TableSkeleton cols={5} />}
          {!suscripcionesLoading &&
            suscripcionesData?.suscripciones.map((s) => (
              <TableRow key={s.id}>
                <TableCell className="capitalize">{s.plan}</TableCell>
                <TableCell>{s.periodo_meses} meses</TableCell>
                <TableCell>{fechaLocal(s.vence_at)}</TableCell>
                <TableCell className="capitalize">{s.estado}</TableCell>
                <TableCell className="text-right">
                  {s.estado === "activa" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCancelar(s)}
                      disabled={cancelar.isPending}
                    >
                      Cancelar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          {!suscripcionesLoading && (suscripcionesData?.suscripciones.length ?? 0) === 0 && (
            <TableRow>
              <TableCell colSpan={5} className="text-text-tertiary">
                No hay suscripciones registradas.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
