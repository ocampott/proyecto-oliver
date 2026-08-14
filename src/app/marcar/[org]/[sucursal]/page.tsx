import { getOrgBySlug } from "@/lib/org";
import { getSucursal } from "@/lib/sucursales";
import { getEmpleadoByToken } from "@/lib/empleados";
import { getDeviceToken } from "@/lib/device-token";
import MarcarClient from "./marcar-client";

interface Props {
  params: Promise<{ org: string; sucursal: string }>;
}

export default async function MarcarPage({ params }: Props) {
  const { org: orgSlug, sucursal: sucursalId } = await params;

  const org = await getOrgBySlug(orgSlug);
  const sucursal = org ? await getSucursal(org.id, sucursalId) : null;

  if (!org || !sucursal || !sucursal.activa) {
    return (
      <main className="flex min-h-screen items-center justify-center p-8">
        <p className="max-w-sm text-center">
          Este enlace no es válido o la sucursal está desactivada. Pedile el QR
          correcto a tu encargado.
        </p>
      </main>
    );
  }

  const token = await getDeviceToken();
  const empleado = token ? await getEmpleadoByToken(token) : null;
  // El vínculo solo vale si el empleado es de esta org.
  const nombre = empleado && empleado.org_id === org.id ? empleado.nombre : null;

  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <MarcarClient
        orgSlug={org.slug}
        sucursalId={sucursal.id}
        sucursalNombre={sucursal.nombre}
        empleadoNombre={nombre}
      />
    </main>
  );
}
