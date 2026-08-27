import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Pencil, Search, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Dialog } from "../../components/ui/dialog";
import { PageHeader } from "../../components/PageHeader";
import { Field } from "../../components/ui/field";
import { IconButton } from "../../components/ui/icon-button";
import { Toolbar } from "../../components/ui/toolbar";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import { ApiError, type OrganizationAdmin } from "../../lib/api";
import {
  useOrganizacionesAdmin,
  useCrearOrganizacionAdmin,
  useEditarOrganizacionAdmin,
  useOrgResumenAdmin,
  useSuscripcionesAdmin,
} from "./hooks";

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

export default function AdminPage() {
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const { data, isLoading, isError, error, refetch } = useOrganizacionesAdmin({ page, pageSize, q: busqueda || undefined });
  const organizaciones = data?.data ?? [];
  const crear = useCrearOrganizacionAdmin();
  const editarOrg = useEditarOrganizacionAdmin();
  const navigate = useNavigate();
  const toast = useToast();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [altaOpen, setAltaOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [editandoOrg, setEditandoOrg] = useState<OrganizationAdmin | null>(null);
  const [editName, setEditName] = useState("");
  const [errorEditOrg, setErrorEditOrg] = useState<string | null>(null);

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await crear.mutateAsync({ name, slug });
      setName("");
      setSlug("");
      setAltaOpen(false);
      toast.success("Organización creada.");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  function abrirEditarOrg(org: OrganizationAdmin) {
    setErrorEditOrg(null);
    setEditandoOrg(org);
    setEditName(org.name);
  }

  async function handleGuardarOrg(e: FormEvent) {
    e.preventDefault();
    if (!editandoOrg) return;
    setErrorEditOrg(null);
    try {
      await editarOrg.mutateAsync({ id: editandoOrg.id, name: editName });
      setEditandoOrg(null);
      toast.success("Organización actualizada.");
    } catch (err) {
      setErrorEditOrg(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    }
  }

  if (isError) {
    const noAutorizado = error instanceof ApiError && error.status === 403;
    return (
      <Card>
        <p className="text-[15px] text-text">
          {noAutorizado
            ? "No tenés acceso a esta sección."
            : "No se pudieron cargar las organizaciones. Probá de nuevo."}
        </p>
        {!noAutorizado && (
          <Button onClick={() => refetch()} variant="secondary" className="mt-4">
            Reintentar
          </Button>
        )}
      </Card>
    );
  }

  return (
    <>
      <PageHeader kicker="Superadmin" title="Organizaciones" />

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

      <Toolbar className="mt-4">
        <Field
          label="Buscar"
          compact
          placeholder="Nombre o slug"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
        <div className="ml-auto">
          <span className="font-mono text-xs text-text-tertiary">
            {data?.pagination.total ?? 0} resultados
          </span>
        </div>
      </Toolbar>

      <Table containerClassName="mt-4">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Vence</TableHead>
            <TableHead>Uso</TableHead>
            <TableHead>Alta</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={7} />}
          {!isLoading &&
            organizaciones.map((org) => (
              <TableRow
                key={org.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => navigate(`/admin/organizaciones/${org.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/admin/organizaciones/${org.id}`);
                  }
                }}
              >
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.slug}</TableCell>
                <TableCell className="capitalize">{org.plan}</TableCell>
                <TableCell>
                  <Vencimiento orgId={org.id} />
                </TableCell>
                <TableCell>
                  <Uso orgId={org.id} />
                </TableCell>
                <TableCell>{fechaLocal(org.created_at)}</TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton onClick={() => abrirEditarOrg(org)} icon={<Pencil className="h-3.5 w-3.5" />} label="Editar organización" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          {!isLoading && organizaciones.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-text-tertiary">
                Todavía no hay organizaciones.
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
          {formError && <p className="text-[15px] text-alert">{formError}</p>}
          <Button type="submit" variant="primary" block disabled={crear.isPending}>
            Agregar
          </Button>
        </form>
      </Dialog>

      <Dialog
        open={editandoOrg != null}
        onClose={() => { setEditandoOrg(null); setErrorEditOrg(null); }}
        title={`Editar ${editandoOrg?.name ?? "organización"}`}
      >
        <form onSubmit={handleGuardarOrg} className="flex flex-col gap-3">
          <Field
            label="Nombre"
            required
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            containerClassName="w-full"
            autoFocus
          />
          {errorEditOrg && <p className="text-[15px] text-alert">{errorEditOrg}</p>}
          <Button type="submit" variant="primary" block disabled={editarOrg.isPending}>
            {editarOrg.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Guardar
          </Button>
        </form>
      </Dialog>

    </>
  );
}

function Vencimiento({ orgId }: { orgId: string }) {
  const { data } = useSuscripcionesAdmin(orgId);
  const activa = data?.suscripciones.find((s) => s.estado === "activa");
  if (!activa) return <span className="text-text-secondary">—</span>;
  return <span>{fechaLocal(activa.vence_at)}</span>;
}

function Uso({ orgId }: { orgId: string }) {
  const { data, isLoading } = useOrgResumenAdmin(orgId);
  if (isLoading || !data) return <span className="text-text-secondary">—</span>;
  return (
    <span className="text-[13px] text-text-secondary">
      {data.empleadosActivos} emp. · {data.sucursalesActivas} suc. · {data.miembros} miembro{data.miembros === 1 ? "" : "s"}
    </span>
  );
}

