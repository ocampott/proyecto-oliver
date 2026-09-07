import { MobileRecords } from "../../components/ui/mobile-records";
import { EmptyState } from "../../components/ui/empty-state";
import { Button } from "../../components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import { Field } from "../../components/ui/field";
import { Toolbar } from "../../components/ui/toolbar";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Status } from "../../components/ui/status";
import { PersonCell } from "../../components/ui/avatar";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { Pagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/PageHeader";
import { fechaLocal } from "../../lib/format";
import { useLegajos } from "./hooks";

export default function LegajosPage() {
  const navigate = useNavigate();
  const [busqueda, setBusqueda] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [consulta, setConsulta] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setConsulta(busqueda.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [busqueda]);

  const { data, isLoading, isError, refetch } = useLegajos({ page, pageSize, q: consulta || undefined });
  const legajos = data?.data ?? [];

  return (
    <>
      <PageHeader title="Legajos" description="Archivos y certificados por empleado." />

      <Toolbar>
        <Field
          label="Buscar por nombre"
          compact
          placeholder="Buscar por nombre"
          value={busqueda}
          onChange={(e) => {
            setBusqueda(e.target.value);
          }}
          containerClassName="w-60"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
        {busqueda !== "" && (
          <ClearFiltersButton
            onClick={() => {
              setBusqueda("");
              setPage(1);
            }}
            className="ml-0"
          />
        )}
        <div className="ml-auto">
          <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
        </div>
      </Toolbar>

      {isError && (
        <p role="alert" className="mt-4 text-alert">
          No se pudieron cargar los legajos. <button type="button" className="underline" onClick={() => refetch()}>Reintentar</button>
        </p>
      )}

      {(isLoading || legajos.length > 0) && <MobileRecords loading={isLoading} items={legajos.map(l => ({
        id: l.empleado_id, title: l.nombre, description: `${l.cantidad_archivos} archivos`,
        meta: l.ultimo_archivo_at ? `Actualizado ${fechaLocal(l.ultimo_archivo_at)}` : "Sin archivos todavía",
        actionLabel: `Ver legajo de ${l.nombre}`, onOpen: () => navigate(`/legajos/${l.empleado_id}`),
      }))} />}
      {!isLoading && !isError && legajos.length === 0 && <EmptyState
        title={consulta ? "No encontramos ese legajo" : "Los legajos empiezan con tu equipo"}
        description={consulta ? "Probá con otro nombre o limpiá la búsqueda." : "Cada empleado tiene su legajo. Cargá tu equipo y después adjuntá sus archivos."}
        action={<Button variant="secondary" onClick={() => consulta ? setBusqueda("") : navigate("/empleados")}>{consulta ? "Limpiar búsqueda" : "Ir a empleados"}</Button>}
      />}
      <Table containerClassName={isLoading || legajos.length > 0 ? "mt-4 hidden md:block" : "hidden"}>
        <TableHeader>
          <TableRow>
            <TableHead>Empleado</TableHead>
            <TableHead>Archivos</TableHead>
            <TableHead>Última actualización</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {isLoading && <TableSkeleton cols={3} />}
          {!isLoading &&
            legajos.map((l) => (
              <TableRow
                key={l.empleado_id}
                className={l.estado === "baja" ? "cursor-pointer text-text-muted" : "cursor-pointer"}
                onClick={() => navigate(`/legajos/${l.empleado_id}`)}
              >
                <TableCell className="relative">
                  <PersonCell nombre={l.nombre} />
                  <button type="button" className="absolute inset-0" aria-label={`Ver legajo de ${l.nombre}`} />
                </TableCell>
                <TableCell>
                  {l.cantidad_archivos > 0 ? (
                    <Status tone="accent">
                      {l.cantidad_archivos} archivo{l.cantidad_archivos === 1 ? "" : "s"}
                    </Status>
                  ) : (
                    <span className="text-text-tertiary">Sin archivos</span>
                  )}
                </TableCell>
                <TableCell className="text-text-secondary">{l.ultimo_archivo_at ? fechaLocal(l.ultimo_archivo_at) : "—"}</TableCell>
              </TableRow>
            ))}
          {!isLoading && !isError && legajos.length === 0 && (
            <TableRow>
              <TableCell colSpan={3} className="py-8 text-center text-text-tertiary">
                No hay empleados que coincidan.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {data && (
        <Pagination
          pagination={data.pagination}
          onPageChange={setPage}
          onPageSizeChange={(s) => {
            setPageSize(s);
            setPage(1);
          }}
        />
      )}
    </>
  );
}
