import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import AsistenciaClient from "./asistencia-client";

export default async function AsistenciaPage() {
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

  return (
    <main className="p-8">
      <AsistenciaClient />
    </main>
  );
}
