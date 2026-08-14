import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { listEmpleados } from "@/lib/empleados";
import { getOtpVigente } from "@/lib/otp";
import EmpleadosClient, { type EmpleadoConOtp } from "./empleados-client";

export default async function EmpleadosPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const org = await getCurrentOrg(user.id);
  if (!org) {
    redirect("/");
  }

  const empleados = await listEmpleados(org.id);

  // OTP vigente de cada empleado sin vincular: el admin se lo muestra al
  // empleado para que vincule su dispositivo (canal provisional del código).
  const conOtp: EmpleadoConOtp[] = await Promise.all(
    empleados.map(async (e) => {
      if (e.device_token) return { ...e, otp: null };
      const otp = await getOtpVigente(e.id);
      return {
        ...e,
        otp: otp ? { code: otp.code, expires_at: otp.expires_at } : null,
      };
    })
  );

  return (
    <main className="p-8">
      <EmpleadosClient empleados={conOtp} />
    </main>
  );
}
