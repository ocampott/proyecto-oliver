import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";

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
      <p className="mt-2 text-sm text-neutral-500">
        Dashboard en construcción — el módulo de conversaciones se suma en
        la próxima etapa.
      </p>
    </main>
  );
}
