import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Plus, Trash2, Loader2, ChevronRight, CalendarDays } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { Badge } from "../../components/ui/badge";
import { Status } from "../../components/ui/status";
import { IconButton } from "../../components/ui/icon-button";
import { PageHeader } from "../../components/PageHeader";
import { useToast } from "../../components/ui/toast";
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { useAuth } from "../../lib/auth";
import { useOrgActual, tieneRol } from "../../lib/hooks";
import type { Miembro, OrgRole } from "../../lib/api";
import { useActualizarOrg, useMiembros, useInvitarMiembro, useEliminarMiembro } from "./hooks";

const ROL_LABEL: Record<OrgRole, string> = {
  owner: "Dueño",
  admin: "Admin",
  agent: "Agente",
};

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

export default function ConfiguracionPage() {
  const { user } = useAuth();
  const { data: org } = useOrgActual();
  const esOwner = tieneRol(org ?? null, ["owner"]);
  const puedeVerEquipo = tieneRol(org ?? null, ["owner", "admin"]);
  const { data: miembros = [], isLoading: miembrosLoading } = useMiembros(puedeVerEquipo);

  const actualizarOrg = useActualizarOrg();
  const invitar = useInvitarMiembro();
  const eliminar = useEliminarMiembro();
  const toast = useToast();

  const [tab, setTab] = useState<"organizacion" | "equipo">("organizacion");
  const [editOrgOpen, setEditOrgOpen] = useState(false);
  const [nombreOrg, setNombreOrg] = useState("");
  const [errorOrg, setErrorOrg] = useState<string | null>(null);

  const [invitarOpen, setInvitarOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [errorInvitar, setErrorInvitar] = useState<string | null>(null);

  const [quitarTarget, setQuitarTarget] = useState<Miembro | null>(null);

  function abrirEditarOrg() {
    setErrorOrg(null);
    setNombreOrg(org?.name ?? "");
    setEditOrgOpen(true);
  }

  async function handleGuardarOrg(e: FormEvent) {
    e.preventDefault();
    setErrorOrg(null);
    try {
      await actualizarOrg.mutateAsync(nombreOrg);
      setEditOrgOpen(false);
      toast.success("Organización actualizada.");
    } catch (err) {
      setErrorOrg(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  async function handleInvitar(e: FormEvent) {
    e.preventDefault();
    setErrorInvitar(null);
    try {
      await invitar.mutateAsync(email);
      setEmail("");
      setInvitarOpen(false);
      toast.success("Invitación enviada.");
    } catch (err) {
      setErrorInvitar(err instanceof Error ? err.message : "No se pudo invitar al usuario.");
    }
  }

  async function handleEliminar() {
    if (!quitarTarget) return;
    try {
      await eliminar.mutateAsync(quitarTarget.userId);
      toast.success(`${quitarTarget.email} ya no forma parte de la organización.`);
      setQuitarTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo quitar al usuario.");
    }
  }

  return (
    <>
      <PageHeader title="Configuración" description="Organización, equipo y permisos." />

      <div className="mt-6">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "organizacion", label: "Organización" },
            // El contenido de "Equipo" está gateado por rol más abajo; si el
            // rol no puede verlo, tampoco tiene que ver la pestaña (quedaba
            // una región vacía para rol `agent`).
            ...(puedeVerEquipo
              ? [{ value: "equipo" as const, label: "Equipo", count: miembros.length }]
              : []),
          ]}
        />
      </div>

      {tab === "organizacion" && (
        <div {...tabPanelProps("organizacion")}>
          <Card className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] text-text">{org?.name ?? "—"}</p>
              <Button
                variant="secondary"
                onClick={abrirEditarOrg}
                disabled={!esOwner}
                title={!esOwner ? "Solo el dueño de la organización puede editar este dato." : undefined}
              >
                Editar
              </Button>
            </div>
          </Card>

          <Card className="mt-4">
            <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-text">Otras configuraciones</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Link
                to="/turnos"
                className="flex items-center gap-3 rounded-[6px] border border-border px-4 py-3 transition-colors hover:bg-text/[.04]"
              >
                <CalendarDays className="h-[18px] w-[18px] text-accent-700" />
                <span className="flex-1">
                  <span className="block text-[14px] font-semibold text-text">Tolerancia de horarios</span>
                  <span className="block text-[12.5px] text-text-secondary">Se administra desde Turnos</span>
                </span>
                <ChevronRight className="h-4 w-4 text-text-tertiary" />
              </Link>
            </div>
          </Card>

          {esOwner && (
            <Card className="mt-4 border-alert/30">
              <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-alert">Zona sensible</h2>
              <p className="mt-1 text-[13.5px] text-text-secondary">
                ¿Necesitás dar de baja esta organización? Escribinos y nos encargamos del resto.
              </p>
              <Button variant="secondary" className="mt-3" asChild>
                <a
                  href={`mailto:soporte@oliver.app?subject=${encodeURIComponent(
                    `Baja de organización: ${org?.name ?? ""}`
                  )}`}
                >
                  Solicitar baja de la organización
                </a>
              </Button>
            </Card>
          )}
        </div>
      )}

      {tab === "equipo" && puedeVerEquipo && (
        <Card {...tabPanelProps("equipo")} className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13.5px] text-text-secondary">
              Quién tiene acceso al panel de esta organización. Por ahora todos los miembros invitados
              tienen el mismo acceso, sin importar el rol.
            </p>
            {esOwner && (
              <Button variant="secondary" onClick={() => { setErrorInvitar(null); setInvitarOpen(true); }}>
                <Plus className="h-4 w-4" />
                Invitar
              </Button>
            )}
          </div>

          <Table containerClassName="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {miembrosLoading && <TableSkeleton cols={5} />}
              {!miembrosLoading &&
                miembros.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      {m.email}
                      {m.userId === user?.id && <span className="text-text-tertiary"> (vos)</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.role === "owner" ? "accent" : "neutral"}>{ROL_LABEL[m.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Status tone={m.activo ? "success" : "warning"}>{m.activo ? "Activo" : "Pendiente"}</Status>
                    </TableCell>
                    <TableCell>{fechaLocal(m.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {esOwner && m.role !== "owner" && (
                        <IconButton
                          onClick={() => setQuitarTarget(m)}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          label="Quitar de la organización"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {!miembrosLoading && miembros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-text-tertiary">
                    Todavía no hay miembros cargados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={editOrgOpen} onClose={() => setEditOrgOpen(false)} title="Editar organización">
        <form onSubmit={handleGuardarOrg} className="flex flex-col gap-3">
          <Field label="Nombre" required value={nombreOrg} onChange={(e) => setNombreOrg(e.target.value)} containerClassName="w-full" autoFocus />
          {errorOrg && <p className="text-[15px] text-alert">{errorOrg}</p>}
          <Button type="submit" variant="primary" block disabled={actualizarOrg.isPending}>
            Guardar
          </Button>
        </form>
      </Dialog>

      <Dialog open={invitarOpen} onClose={() => setInvitarOpen(false)} title="Invitar a la organización">
        <form onSubmit={handleInvitar} className="flex flex-col gap-3">
          <p className="-mt-1 text-[13.5px] text-text-secondary">
            Le mandamos un mail para que arme su contraseña y entre directo a esta organización.
          </p>
          <Field
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            containerClassName="w-full"
            autoFocus
          />
          {errorInvitar && <p className="text-[15px] text-alert">{errorInvitar}</p>}
          <Button type="submit" variant="primary" block disabled={invitar.isPending}>
            {invitar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Invitar
          </Button>
        </form>
      </Dialog>

      <Dialog open={quitarTarget != null} onClose={() => setQuitarTarget(null)} title="Quitar de la organización">
        <p className="text-[15px] text-text-secondary">
          ¿Quitar a <strong>{quitarTarget?.email}</strong> de esta organización? Pierde el acceso al panel
          de inmediato.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setQuitarTarget(null)}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleEliminar} disabled={eliminar.isPending}>
            {eliminar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Quitar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
