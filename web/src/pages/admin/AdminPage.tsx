import { useState, type FormEvent } from "react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../components/ui/table";
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
  const [formError, setFormError] = useState<string | null>(null);

  async function handleAlta(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await crear.mutateAsync({ name, slug });
      setName("");
      setSlug("");
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

      <form onSubmit={handleAlta} className="mt-4 flex flex-wrap items-end gap-2">
        <Field label="Nombre" required value={name} onChange={(e) => setName(e.target.value)} />
        <Field label="Slug" required value={slug} onChange={(e) => setSlug(e.target.value)} />
        <Button type="submit" variant="primary" disabled={crear.isPending}>
          Agregar
        </Button>
      </form>

      {formError && <p className="mt-2 text-[15px] text-accent-700">{formError}</p>}

      <Table className="mt-6">
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Slug</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Alta</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && (
            <TableRow>
              <TableCell colSpan={4} className="text-text/60">
                Cargando...
              </TableCell>
            </TableRow>
          )}
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
    </main>
  );
}
