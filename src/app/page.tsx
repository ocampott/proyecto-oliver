import { redirect } from "next/navigation";
import { createServerClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";

export default async function Home() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  if (await isPlatformAdmin(user.id)) {
    redirect("/admin");
  }
  if (!process.env.NEXT_PUBLIC_BASE_URL) {
    throw new Error("Falta la variable de entorno NEXT_PUBLIC_BASE_URL");
  }
  redirect(process.env.NEXT_PUBLIC_BASE_URL);
}
