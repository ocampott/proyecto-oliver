import * as React from "react";
import { NavLink } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { IconButton } from "./ui/icon-button";
import { cn } from "../lib/utils";

interface NavItem {
  href: string;
  label: string;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia" },
  { href: "/horas", label: "Horas" },
  { href: "/turnos", label: "Turnos" },
  { href: "/rrhh", label: "RRHH" },
  { href: "/empleados", label: "Empleados" },
  { href: "/sucursales", label: "Sucursales" },
];

const desktopLinkClass = ({ isActive }: { isActive: boolean }) =>
  cn(
    "rounded-full px-4 py-2 text-[13.5px] font-medium transition-colors duration-200",
    isActive
      ? "bg-accent-100 font-semibold text-accent-700"
      : "text-text-secondary hover:bg-black/[.03] hover:text-text"
  );

export function PanelNav() {
  const [open, setOpen] = React.useState(false);
  const navRef = React.useRef<HTMLElement>(null);

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
          <div className="hidden items-center gap-0.5 md:flex">
            {LINKS.map((item) => (
              <NavLink key={item.href} to={item.href} end className={desktopLinkClass}>
                {item.label}
              </NavLink>
            ))}
          </div>
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
          {LINKS.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              end
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                cn(
                  "rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors duration-200",
                  isActive
                    ? "bg-accent-100 font-semibold text-accent-700"
                    : "text-text-secondary hover:bg-black/[.03] hover:text-text"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
