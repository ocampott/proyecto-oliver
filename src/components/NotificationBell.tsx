import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { getPendientesOperacion } from "../lib/api";
import { puedeGestionar, tieneModulo, useOrgActual } from "../lib/hooks";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data: org } = useOrgActual();
  const habilitado = puedeGestionar(org ?? null) && tieneModulo(org?.entitlements ?? null, "rrhh");
  const { data, isLoading, isError } = useQuery({
    queryKey: ["pendientes"], queryFn: ({ signal }) => getPendientesOperacion(signal),
    enabled: habilitado, staleTime: 30_000, refetchInterval: habilitado ? 60_000 : false,
  });
  useEffect(() => {
    if (!open) return;
    function click(e: MouseEvent) { if (!ref.current?.contains(e.target as Node)) setOpen(false); }
    function key(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("mousedown", click); window.addEventListener("keydown", key);
    return () => { document.removeEventListener("mousedown", click); window.removeEventListener("keydown", key); };
  }, [open]);
  if (!habilitado) return null;
  // Categorías pueden solaparse: no sumar certificados + solicitudes como personas.
  const hayPendientes = !!data && (data.totalSolicitudes > 0 || data.totalCertificados > 0 || data.marcasRechazadas > 0);
  return (
    <div className="relative" ref={ref}>
      <button type="button" aria-label={hayPendientes ? "Ver pendientes de RRHH" : "Ver estado de RRHH"} aria-expanded={open}
        onClick={() => setOpen(!open)} className="relative rounded-lg p-2 text-text-secondary hover:bg-surface">
        <Bell className="h-5 w-5" />
        {hayPendientes && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-accent" />}
      </button>
      {open && <div className="absolute right-0 z-50 mt-2 w-72 space-y-3 rounded-lg border border-border bg-surface-raised p-4 shadow-lg">
        <h2 className="font-semibold">Pendientes reales</h2>
        {isLoading && <p role="status" className="text-sm">Cargando…</p>}
        {isError && <p role="alert" className="text-sm">No se pudieron consultar los pendientes.</p>}
        {data && !isError && <ul className="space-y-1 text-sm">
          <li>{data.totalSolicitudes} solicitudes por revisar</li>
          <li>{data.totalCertificados} certificados pendientes</li>
          <li>{data.marcasRechazadas} marcas rechazadas</li>
        </ul>}
        <Link to="/rrhh" className="block text-sm text-accent underline" onClick={() => setOpen(false)}>Abrir pendientes</Link>
      </div>}
    </div>
  );
}
