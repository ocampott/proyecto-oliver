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
    <nav className="sticky top-0 z-20 flex items-center gap-6 border-b-2 border-divider bg-bg px-6 py-5">
      <span className="mr-auto text-[22px] font-extrabold text-text">Oliver</span>
      {LINKS.map((item) => (
        <NavLink
          key={item.href}
          to={item.href}
          end
          className={({ isActive }) =>
            isActive ? "text-[15px] text-accent-700" : "text-[15px] text-text hover:text-accent-700"
          }
        >
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
