import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Home,
  ClipboardCheck,
  Users,
  Building2,
  Clock,
  CalendarDays,
  HeartHandshake,
  Settings,
  ShieldCheck,
  CreditCard,
  UserPlus,
  CalendarPlus,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import { useOrgActual, tieneModulo, tieneRol } from "../lib/hooks";
import { useEmpleados } from "../pages/empleados/hooks";
import { useSucursales } from "../pages/sucursales/hooks";
import { cn } from "../lib/utils";
import type { Modulo } from "../lib/api";

export interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

interface ResultItem {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  meta?: string;
  onSelect: () => void;
}

interface ResultGroup {
  heading: string;
  items: ResultItem[];
}

interface PaginaItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  modulo?: Modulo;
  soloGestion?: boolean;
  soloSuperadmin?: boolean;
}

const PAGINAS: PaginaItem[] = [
  { href: "/", label: "Inicio", icon: Home },
  { href: "/asistencia", label: "Asistencia", icon: ClipboardCheck, modulo: "asistencia" },
  { href: "/empleados", label: "Empleados", icon: Users },
  { href: "/sucursales", label: "Sucursales", icon: Building2 },
  { href: "/horas", label: "Horas", icon: Clock, modulo: "horas", soloGestion: true },
  { href: "/turnos", label: "Turnos", icon: CalendarDays, modulo: "turnos", soloGestion: true },
  { href: "/rrhh", label: "Ausencias", icon: HeartHandshake, modulo: "rrhh", soloGestion: true },
  { href: "/configuracion", label: "Configuración", icon: Settings },
  { href: "/plan", label: "Mi plan", icon: CreditCard },
  { href: "/admin", label: "Panel admin", icon: ShieldCheck, soloSuperadmin: true },
];

export function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");
  const [activeIndex, setActiveIndex] = React.useState(0);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { data: org } = useOrgActual();
  const ent = org?.entitlements ?? null;
  const { data: empleados = [], isLoading: empleadosLoading } = useEmpleados();
  // ponytail: pageSize 30 fijo (default del hook) — orgs con más de 30
  // sucursales no van a tener cobertura completa acá; pasar a q server-side
  // si algún cliente real llega a ese tamaño.
  const { data: sucursalesPage, isLoading: sucursalesLoading } = useSucursales();
  const sucursales = sucursalesPage?.data ?? [];

  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  React.useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  function go(path: string) {
    onClose();
    navigate(path);
  }

  const q = query.trim().toLowerCase();
  // Con query escrita y las queries de empleados/sucursales todavía en
  // vuelo, los grupos rinden vacío: sin esto el usuario ve "Sin resultados."
  // como si de verdad no hubiera match.
  const buscando = q !== "" && (empleadosLoading || sucursalesLoading);
  const puedeGestionar = tieneRol(org ?? null, ["owner", "admin"]);

  const paginas: ResultItem[] = PAGINAS.filter((p) => {
    if (p.soloSuperadmin && !ent?.ilimitado) return false;
    if (p.soloGestion && !puedeGestionar) return false;
    if (p.modulo && !tieneModulo(ent, p.modulo)) return false;
    return !q || p.label.toLowerCase().includes(q);
  }).map((p) => ({ key: `pagina-${p.href}`, icon: p.icon, label: p.label, onSelect: () => go(p.href) }));

  const accionesBase: ResultItem[] = [
    { key: "accion-empleado", icon: UserPlus, label: "Nuevo empleado", onSelect: () => go("/empleados") },
    { key: "accion-ausencia", icon: CalendarPlus, label: "Registrar ausencia", onSelect: () => go("/rrhh") },
    { key: "accion-rechazadas", icon: AlertTriangle, label: "Revisar marcas rechazadas", onSelect: () => go("/asistencia") },
  ];
  const acciones = puedeGestionar ? accionesBase.filter((a) => !q || a.label.toLowerCase().includes(q)) : [];

  const empleadosResultados: ResultItem[] = q
    ? empleados
        .filter((e) => `${e.nombre} ${e.apellido ?? ""}`.toLowerCase().includes(q))
        .slice(0, 6)
        .map((e) => ({
          key: `empleado-${e.id}`,
          icon: Users,
          label: `${e.nombre} ${e.apellido ?? ""}`.trim(),
          meta: "Ver en Empleados",
          onSelect: () => go("/empleados"),
        }))
    : [];

  const sucursalesResultados: ResultItem[] = q
    ? sucursales
        .filter((s) => s.nombre.toLowerCase().includes(q))
        .slice(0, 6)
        .map((s) => ({
          key: `sucursal-${s.id}`,
          icon: Building2,
          label: s.nombre,
          meta: "Ver en Sucursales",
          onSelect: () => go("/sucursales"),
        }))
    : [];

  const grupos: ResultGroup[] = [
    { heading: "Ir a", items: paginas },
    { heading: "Acciones", items: acciones },
    { heading: "Empleados", items: empleadosResultados },
    { heading: "Sucursales", items: sucursalesResultados },
  ].filter((g) => g.items.length > 0);

  const flat = grupos.flatMap((g) => g.items);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, flat.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      flat[activeIndex]?.onSelect();
    }
  }

  // La lista tiene max-h-[360px]: al moverse con flechas hay que arrastrar
  // el item activo a la vista.
  const activeRef = React.useRef<HTMLButtonElement>(null);
  React.useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!open) return null;

  let renderedIndex = -1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-text/40 pt-[12vh] backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscador"
        className="flex w-full max-w-[560px] flex-col overflow-hidden rounded-[10px] border border-border bg-surface-raised shadow-[0_16px_48px_rgba(13,13,17,.18)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 shrink-0 text-text-tertiary" />
          <input
            ref={inputRef}
            aria-label="Buscar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar páginas, empleados, sucursales…"
            className="w-full bg-transparent text-[14px] text-text placeholder:text-text-tertiary focus:outline-none"
          />
        </div>
        <div className="max-h-[360px] overflow-y-auto p-2">
          {flat.length === 0 && (
            <p className="px-3 py-6 text-center text-[13.5px] text-text-tertiary">
              {buscando ? "Buscando…" : "Sin resultados."}
            </p>
          )}
          {grupos.map((group) => (
            <div key={group.heading} className="mb-1 last:mb-0">
              <p className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary">
                {group.heading}
              </p>
              {group.items.map((item) => {
                renderedIndex += 1;
                const isActive = renderedIndex === activeIndex;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    ref={isActive ? activeRef : undefined}
                    type="button"
                    onMouseEnter={() => setActiveIndex(renderedIndex)}
                    onClick={item.onSelect}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-[8px] px-3 py-2 text-left text-[13.5px]",
                      isActive ? "bg-accent-100 text-accent-800" : "text-text hover:bg-text/[.04]"
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{item.label}</span>
                    {item.meta && <span className="shrink-0 text-[11.5px] text-text-tertiary">{item.meta}</span>}
                    {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-accent-700" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
