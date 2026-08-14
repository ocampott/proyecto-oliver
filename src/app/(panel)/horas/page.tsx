import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/org";
import HorasClient from "./horas-client";

export default async function HorasPage() {
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
      <HorasClient />
    </main>
  );
}
