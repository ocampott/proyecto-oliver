import { useState, type FormEvent } from "react";
import { Plus } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Dialog } from "../../components/ui/dialog";
import { Field } from "../../components/ui/field";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { ApiError } from "../../lib/api";
import { useOrganizacionesAdmin, useCrearOrganizacionAdmin } from "./hooks";

function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR");
}

export default function AdminPage() {
  const { data: organizaciones = [], isLoading, isError, error } = useOrganizacionesAdmin();
  const crear = useCrearOrganizacionAdmin();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [altaOpen, setAltaOpen] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

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
            <TableHead>Alta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={4} />}
          {!isLoading &&
            organizaciones.map((org) => (
              <TableRow key={org.id}>
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.slug}</TableCell>
                <TableCell>{org.plan}</TableCell>
                <TableCell>{fechaLocal(org.created_at)}</TableCell>
              </TableRow>
            ))}
          {!isLoading && organizaciones.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-text/60">
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
    </main>
  );
}
