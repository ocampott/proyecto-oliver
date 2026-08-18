import Link from "next/link";

const LINKS = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia" },
  { href: "/horas", label: "Horas" },
];

export default function OrgNav() {
  return (
    <nav className="border-b px-8 py-3">
      <div className="flex gap-4 text-sm">
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className="hover:underline">
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
