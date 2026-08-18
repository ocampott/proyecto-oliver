import { NavLink } from "react-router-dom";

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
    <nav className="border-b-2 border-divider bg-surface px-8 py-3">
      <div className="flex gap-4 text-[15px]">
        {LINKS.map((item) => (
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
        ))}
      </div>
    </nav>
  );
}
