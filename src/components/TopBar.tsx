import { Menu } from "lucide-react";
import { NavLink } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";
import { NotificationBell } from "./NotificationBell";
import { IconButton } from "./ui/icon-button";

const NAV = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia" },
  { href: "/empleados", label: "Empleados" },
  { href: "/sucursales", label: "Sucursales" },
  { href: "/horas", label: "Horas" },
  { href: "/turnos", label: "Turnos" },
  { href: "/rrhh", label: "RRHH" },
];

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex min-h-16 items-center border-b border-border-soft bg-surface/95 px-4 backdrop-blur-sm md:px-8">
      <IconButton
        className="mr-3 md:hidden"
        onClick={onMenuClick}
        label="Abrir menú"
        icon={<Menu className="h-[18px] w-[18px]" />}
      />
      <NavLink to="/" className="shrink-0 text-[19px] font-extrabold tracking-[-0.04em] text-text">
        oliver<span className="text-accent">.</span>
      </NavLink>
      <nav aria-label="Navegación principal" className="ml-8 hidden items-center gap-1 lg:flex">
        {NAV.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            className={({ isActive }) =>
              `rounded-lg px-3 py-2 text-[13px] font-semibold transition-colors ${
                isActive ? "bg-accent-100 text-accent-700" : "text-text-secondary hover:bg-bg hover:text-text"
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        <div className="hidden items-center gap-2 rounded-lg border border-border-soft bg-bg px-3 py-2 text-[12px] font-semibold text-text-secondary sm:flex">
          <span className="h-2 w-2 rounded-full bg-success" aria-hidden="true" />
          Operación normal
        </div>
        <NotificationBell />
        <AccountMenu />
      </div>
    </header>
  );
}

