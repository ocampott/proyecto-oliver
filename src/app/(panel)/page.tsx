import Link from "next/link";
import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

const ACCESOS = [
  { href: "/asistencia", label: "Asistencia", detalle: "Registros de entrada/salida e intentos rechazados" },
  { href: "/horas", label: "Horas", detalle: "Turnos y horas trabajadas por empleado" },
  { href: "/empleados", label: "Empleados", detalle: "Nómina, vínculo de dispositivos y códigos" },
  { href: "/sucursales", label: "Sucursales", detalle: "Ubicaciones, geocercas y códigos QR" },
];

export default async function Home() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const org = await getCurrentOrg(user.id);
  if (!org) {
    return (
      <main className="p-8">
        <p>
          Tu cuenta todavía no está asociada a ninguna organización.
          Contactá a soporte.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">{org.name}</h1>
      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        {ACCESOS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className="rounded-lg border p-4 hover:bg-neutral-50"
          >
            <h2 className="text-lg font-semibold">{a.label}</h2>
            <p className="mt-1 text-sm text-neutral-500">{a.detalle}</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
