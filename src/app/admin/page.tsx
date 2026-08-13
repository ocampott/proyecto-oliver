import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin } from "@/lib/admin";

export default async function AdminPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }
  if (!(await isPlatformAdmin(user.id))) {
    redirect("/");
  }

  const service = createServiceClient();
  const { data: organizations, error } = await service
    .from("organizations")
    .select("id, name, slug, plan, created_at")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Organizaciones</h1>
      <table className="mt-4 w-full text-left text-sm">
        <thead>
          <tr>
            <th className="border-b p-2">Nombre</th>
            <th className="border-b p-2">Slug</th>
            <th className="border-b p-2">Plan</th>
            <th className="border-b p-2">Alta</th>
          </tr>
        </thead>
        <tbody>
          {organizations?.map((org) => (
            <tr key={org.id}>
              <td className="border-b p-2">{org.name}</td>
              <td className="border-b p-2">{org.slug}</td>
              <td className="border-b p-2">{org.plan}</td>
              <td className="border-b p-2">
                {new Date(org.created_at).toLocaleDateString("es-AR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
