import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import { listSucursales } from "@/lib/sucursales";
import SucursalesClient from "./sucursales-client";

export default async function SucursalesPage() {
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

  const sucursales = await listSucursales(org.id);
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:5173";

  return (
    <main className="p-8">
      <SucursalesClient sucursales={sucursales} orgSlug={org.slug} baseUrl={baseUrl} />
    </main>
  );
}
