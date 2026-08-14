import type { User } from "@supabase/supabase-js";
import { createServerClient } from "./supabase/server";
import { getCurrentOrg, type Organization } from "./org";

/**
 * Guard para route handlers autenticados de una organización.
 * Devuelve { user, org } o null si no hay sesión o el usuario no tiene org
 * (el caller responde 403).
 */
export async function requireOrg(): Promise<{ user: User; org: Organization } | null> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const org = await getCurrentOrg(user.id);
  if (!org) return null;

  return { user, org };
}
