import { NavLink } from "react-router-dom";

interface NavItem {
  href: string;
  label: string;
  disabled?: boolean;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia", disabled: true },
  { href: "/horas", label: "Horas", disabled: true },
  { href: "/empleados", label: "Empleados", disabled: true },
  { href: "/sucursales", label: "Sucursales", disabled: true },
];

const TOOLTIP_DESHABILITADO = "Todavía en el panel viejo (localhost:3000)";

export function PanelNav() {
  return (
    <nav className="border-b border-text/10 bg-surface px-8 py-3">
      <div className="flex gap-4 text-[15px]">
        {LINKS.map((item) =>
          item.disabled ? (
            <span key={item.href} title={TOOLTIP_DESHABILITADO} className="cursor-not-allowed text-text/40">
              {item.label}
            </span>
          ) : (
            <NavLink
              key={item.href}
              to={item.href}
              end
              className={({ isActive }) =>
                isActive ? "font-extrabold text-text" : "text-text hover:underline"
              }
            >
              {item.label}
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}

export { TOOLTIP_DESHABILITADO };
