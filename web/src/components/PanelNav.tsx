import { NavLink } from "react-router-dom";
import { AccountMenu } from "./AccountMenu";

interface NavItem {
  href: string;
  label: string;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia" },
  { href: "/horas", label: "Horas" },
  { href: "/empleados", label: "Empleados" },
  { href: "/sucursales", label: "Sucursales" },
];

export function PanelNav() {
  return (
    <nav className="sticky top-0 z-20 flex items-center bg-white/90 px-8 py-3.5 shadow-[0_1px_0_rgba(24,24,27,0.07)] backdrop-blur-sm">
      <span className="text-[17px] font-extrabold tracking-tight text-text">oliver</span>
      <div className="ml-auto flex items-center gap-0.5">
        {LINKS.map((item) => (
          <NavLink
            key={item.href}
            to={item.href}
            end
            className={({ isActive }) =>
              isActive
                ? "rounded-full bg-accent-100 px-4 py-2 text-[13.5px] font-semibold text-accent-700"
                : "rounded-full px-4 py-2 text-[13.5px] font-medium text-text-secondary hover:text-text"
            }
          >
            {item.label}
          </NavLink>
        ))}
        <AccountMenu />
      </div>
    </nav>
  );
}
