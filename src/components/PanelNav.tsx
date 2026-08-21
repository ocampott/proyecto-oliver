import * as React from "react";
import { NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { IconButton } from "./ui/icon-button";
import { Badge } from "./ui/badge";
import { cn } from "../lib/utils";
import { useOrgActual, tieneModulo } from "../lib/hooks";
import type { Modulo, PlanSlug, Entitlements } from "../lib/api";

interface NavItem {
  href: string;
  label: string;
  modulo?: Modulo;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia", modulo: "asistencia" },
  { href: "/empleados", label: "Empleados" },
  { href: "/sucursales", label: "Sucursales" },
  { href: "/horas", label: "Horas", modulo: "horas" },
  { href: "/turnos", label: "Turnos", modulo: "turnos" },
  { href: "/rrhh", label: "RRHH", modulo: "rrhh" },
];

const PLAN_REQUERIDO: Record<Modulo, PlanSlug> = {
  asistencia: "gratis",
  horas: "basico",
  turnos: "basico",
  rrhh: "basico",
  reportes: "basico",
};

const PLAN_NOMBRE: Record<PlanSlug, string> = {
  gratis: "Gratis",
  basico: "Básico",
  pro: "Pro",
};

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors duration-200",
    isActive
      ? "bg-accent-100 font-semibold text-accent-700"
      : "text-text-secondary hover:bg-black/[.03] hover:text-text"
  );

// Anchos aproximados de cada label, para que el skeleton no se vea como
// una fila de barras todas iguales mientras carga.
const SKELETON_WIDTHS = ["w-14", "w-24", "w-20", "w-24", "w-14", "w-16", "w-12"];

export function PanelNav() {
  const [open, setOpen] = React.useState(false);
  const navRef = React.useRef<HTMLElement>(null);
  const { data: org, isLoading } = useOrgActual();
  const ent = org?.entitlements ?? null;

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <nav
      ref={navRef}
      className="sticky top-0 z-20 bg-white/90 px-4 py-3.5 shadow-[0_1px_0_rgba(24,24,27,0.07)] backdrop-blur-sm md:px-8"
    >
      <div className="flex items-center">
        <span className="text-[17px] font-extrabold tracking-tight text-text">oliver</span>
        <div className="ml-auto flex items-center gap-2">
          {isLoading ? (
            <div className="hidden items-center gap-4 px-1 md:flex" aria-hidden="true">
              {LINKS.map((item, i) => (
                <span
                  key={item.href}
                  className={cn("h-[13px] animate-pulse rounded-full bg-text/10", SKELETON_WIDTHS[i])}
                />
              ))}
            </div>
          ) : (
            <div className="hidden items-center gap-0.5 md:flex">
              {LINKS.map((item) => (
                <NavLinkItem key={item.href} item={item} ent={ent} />
              ))}
            </div>
          )}
          <AccountMenu />
          <IconButton
            className="md:hidden"
            onClick={() => setOpen((v) => !v)}
            label={open ? "Cerrar menú" : "Abrir menú"}
            icon={open ? <X className="h-[18px] w-[18px]" /> : <Menu className="h-[18px] w-[18px]" />}
          />
        </div>
      </div>
      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 ease-out md:hidden",
          open ? "mt-3 grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div className="flex flex-col gap-0.5 overflow-hidden">
          {isLoading
            ? LINKS.map((item, i) => (
                <span key={item.href} className="flex items-center px-3 py-2.5">
                  <span className={cn("h-[13px] animate-pulse rounded-full bg-text/10", SKELETON_WIDTHS[i])} />
                </span>
              ))
            : LINKS.map((item) => (
                <NavLinkItem key={item.href} item={item} ent={ent} mobile onClick={() => setOpen(false)} />
              ))}
        </div>
      </div>
    </nav>
  );
}

function NavLinkItem({
  item,
  ent,
  mobile,
  onClick,
}: {
  item: NavItem;
  ent: Entitlements | null;
  mobile?: boolean;
  onClick?: () => void;
}) {
  const bloqueado = item.modulo ? !tieneModulo(ent, item.modulo) : false;
  const planReq = item.modulo ? PLAN_REQUERIDO[item.modulo] : null;
  const aviso = bloqueado && planReq
    ? `Disponible con el plan ${PLAN_NOMBRE[planReq]}. Hacé click para ver los planes.`
    : undefined;

  if (bloqueado && planReq) {
    return (
      <NavLink
        to="/plan"
        onClick={onClick}
        title={aviso}
        className={cn(
          "inline-flex items-center gap-1.5",
          mobile
            ? "rounded-lg px-3 py-2.5 text-[14px] font-medium text-text-secondary hover:bg-black/[.03] hover:text-text"
            : desktopLinkClass({ isActive: false })
        )}
      >
        {item.label}
        <Badge variant="outline" className="text-[10px]">
          {PLAN_NOMBRE[planReq]}
        </Badge>
      </NavLink>
    );
  }

  return (
    <NavLink
      to={item.href}
      end
      onClick={onClick}
      className={mobile ? undefined : desktopLinkClass}
    >
      {({ isActive }) => (
        <span
          className={cn(
            mobile &&
              "block rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
            mobile && (isActive ? "bg-accent-100 font-semibold text-accent-700" : "text-text-secondary hover:bg-black/[.03] hover:text-text")
          )}
        >
          {item.label}
        </span>
      )}
    </NavLink>
  );
}
