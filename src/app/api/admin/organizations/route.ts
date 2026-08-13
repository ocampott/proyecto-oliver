import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase/server";
import { isPlatformAdmin } from "@/lib/admin";
import { createOrganization } from "@/lib/organizations";

export async function POST(req: NextRequest) {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !(await isPlatformAdmin(user.id))) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | { name?: string; slug?: string }
    | null;
  if (!body?.name || !body?.slug) {
    return NextResponse.json(
      { error: "name y slug son requeridos" },
      { status: 400 }
    );
  }

  try {
    const org = await createOrganization({ name: body.name, slug: body.slug });
    return NextResponse.json({ organization: org });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error al crear la organización";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
