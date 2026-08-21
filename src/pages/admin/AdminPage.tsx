import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { ApiError, getPlanes, type OrganizationAdmin, type SuscripcionAdmin, type PlanesResponse } from "../../lib/api";
import {
  useOrganizacionesAdmin,
  useCrearOrganizacionAdmin,
  useSuscripcionesAdmin,
  useCrearSuscripcionAdmin,
  useCancelarSuscripcionAdmin,
} from "./hooks";

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

function precioFormateado(n: number): string {
  return `$${n.toLocaleString("es-AR")}`;
}

export default function AdminPage() {
  const { data: organizaciones = [], isLoading, isError, error } = useOrganizacionesAdmin();
  const crear = useCrearOrganizacionAdmin();
  const { data: catalogo } = useQuery({ queryKey: ["planes"], queryFn: getPlanes });

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [altaOpen, setAltaOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [gestionOrg, setGestionOrg] = useState<OrganizationAdmin | null>(null);

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await crear.mutateAsync({ name, slug });
      setName("");
      setSlug("");
      setAltaOpen(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  if (isError) {
    const noAutorizado = error instanceof ApiError && error.status === 403;
    return (
      <main className="mx-auto w-full max-w-[1440px] px-8 py-8">
        <p className="text-[15px] text-text">
          {noAutorizado
            ? "No tenés acceso a esta sección."
            : "No se pudieron cargar las organizaciones. Probá de nuevo."}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[1440px] px-8 py-8">
      <h1 className="text-[32px] font-extrabold text-text">Organizaciones</h1>

      <div className="mt-4 flex justify-end">
        <Button
          variant="primary"
          onClick={() => {
            setFormError(null);
            setAltaOpen(true);
          }}
        >
          <Plus className="h-4 w-4" />
          Nueva organización
        </Button>
      </div>

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead>Alta</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={6} />}
          {!isLoading &&
            organizaciones.map((org) => (
              <TableRow key={org.id}>
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.slug}</TableCell>
                <TableCell className="capitalize">{org.plan}</TableCell>
                <TableCell>
                  <Vencimiento orgId={org.id} />
                </TableCell>
                <TableCell>{fechaLocal(org.created_at)}</TableCell>
                <TableCell className="text-right">
                  <Button variant="secondary" className="h-8 px-2.5 text-[13px]" onClick={() => setGestionOrg(org)}>
                    Gestionar suscripción
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && organizaciones.length === 0 && (
            <TableRow>
              <TableCell colSpan={6} className="text-text/60">
                Todavía no hay organizaciones.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      <Dialog
        open={altaOpen}
        onClose={() => {
          setAltaOpen(false);
          setFormError(null);
        }}
        title="Nueva organización"
      >
        <form onSubmit={handleAlta} className="flex flex-col gap-3">
          <Field
            label="Nombre"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            containerClassName="w-full"
          />
          <Field
            label="Slug"
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            containerClassName="w-full"
          />
          {formError && <p className="text-[15px] text-accent-700">{formError}</p>}
          <Button type="submit" variant="primary" block disabled={crear.isPending}>
            Agregar
          </Button>
        </form>
      </Dialog>

      {gestionOrg && (
        <GestionSuscripcionDialog
          org={gestionOrg}
          planes={catalogo?.planes ?? []}
          onClose={() => setGestionOrg(null)}
        />
      )}
    </main>
  );
}

function Vencimiento({ orgId }: { orgId: string }) {
  const { data } = useSuscripcionesAdmin(orgId);
  const activa = data?.suscripciones.find((s) => s.estado === "activa");
  if (!activa) return <span className="text-text-secondary">—</span>;
  return <span>{fechaLocal(activa.vence_at)}</span>;
}

interface GestionSuscripcionDialogProps {
  org: OrganizationAdmin;
  planes: PlanesResponse["planes"];
  onClose: () => void;
}

function GestionSuscripcionDialog({ org, planes, onClose }: GestionSuscripcionDialogProps) {
  const { data: suscripcionesData, isLoading: suscripcionesLoading } = useSuscripcionesAdmin(org.id);
  const crear = useCrearSuscripcionAdmin(org.id);
  const cancelar = useCancelarSuscripcionAdmin(org.id);

  const [plan, setPlan] = useState<"basico" | "pro">("basico");
  const [periodo, setPeriodo] = useState<string>("1");
  const [precio, setPrecio] = useState<string>("");
  const [notas, setNotas] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const planDef = planes.find((p) => p.slug === plan);
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
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleCancelar(suscripcion: SuscripcionAdmin) {
    if (!confirm("¿Cancelar esta suscripción? La organización volverá al plan Gratis.")) return;
    try {
      await cancelar.mutateAsync(suscripcion.id);
    } catch {
      // el error queda en cancelar.error
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Suscripción: ${org.name}`}>
      <div className="flex max-h-[80vh] flex-col gap-4">
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
              Precio calculado:{" "}
              <span className="font-semibold text-text">{precioFormateado(periodoDef.precioTotal)}</span>
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

          {formError && <p className="text-[15px] text-accent-700">{formError}</p>}

          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={crear.isPending}>
              Registrar suscripción
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cerrar
            </Button>
          </div>
        </form>

        <div>
          <h3 className="text-[16px] font-semibold text-text">Historial</h3>
          {suscripcionesLoading && <p className="text-[14px] text-text-secondary">Cargando...</p>}
          {!suscripcionesLoading && (suscripcionesData?.suscripciones.length ?? 0) === 0 && (
            <p className="text-[14px] text-text-secondary">No hay suscripciones registradas.</p>
          )}
          {!suscripcionesLoading && (suscripcionesData?.suscripciones.length ?? 0) > 0 && (
            <div className="mt-2 max-h-[240px] overflow-auto rounded-[10px] border border-border">
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
                  {suscripcionesData!.suscripciones.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="capitalize">{s.plan}</TableCell>
                      <TableCell>{s.periodo_meses} meses</TableCell>
                      <TableCell>{fechaLocal(s.vence_at)}</TableCell>
                      <TableCell className="capitalize">{s.estado}</TableCell>
                      <TableCell className="text-right">
                        {s.estado === "activa" && (
                          <Button
                            variant="secondary"
                            className="h-7 px-2 text-[12px]"
                            onClick={() => handleCancelar(s)}
                            disabled={cancelar.isPending}
                          >
                            Cancelar
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </Dialog>
  );
}
