// Crea (si no existen) el usuario, org, sucursal y empleado demo para
// probar el módulo de Asistencia en local. Idempotente: correrlo de nuevo
// no duplica nada. Pensado para correr después de `npx supabase db reset`.
//
// Uso: node scripts/seed-demo.js

const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const { data: users, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;
  let user = users.users.find((u) => u.email === "demo@test.local");
  if (!user) {
    const { data, error } = await supabase.auth.admin.createUser({
      email: "demo@test.local",
      password: "demo123456",
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
    console.log("usuario demo creado");
  } else {
    console.log("usuario demo ya existía");
  }

  let { data: org } = await supabase
    .from("organizations")
    .select("id, slug")
    .eq("slug", "cliente-prueba")
    .maybeSingle();
  if (!org) {
    const { data, error } = await supabase
      .from("organizations")
      .insert({ name: "Cliente de prueba", slug: "cliente-prueba" })
      .select()
      .single();
    if (error) throw error;
    org = data;
    console.log("org demo creada");
  } else {
    console.log("org demo ya existía");
  }

  const { data: member } = await supabase
    .from("org_members")
    .select("user_id")
    .eq("user_id", user.id)
    .eq("org_id", org.id)
    .maybeSingle();
  if (!member) {
    const { error } = await supabase
      .from("org_members")
      .insert({ user_id: user.id, org_id: org.id, role: "owner" });
    if (error) throw error;
    console.log("membership creada");
  } else {
    console.log("membership ya existía");
  }

  let { data: sucursal } = await supabase
    .from("sucursales")
    .select("id")
    .eq("org_id", org.id)
    .eq("nombre", "Casa Central")
    .maybeSingle();
  if (!sucursal) {
    const { data, error } = await supabase
      .from("sucursales")
      .insert({ org_id: org.id, nombre: "Casa Central", lat: -34.6037, lon: -58.3816, radio_metros: 100 })
      .select()
      .single();
    if (error) throw error;
    sucursal = data;
    console.log("sucursal demo creada:", sucursal.id);
  } else {
    console.log("sucursal demo ya existía:", sucursal.id);
  }

  let { data: empleado } = await supabase
    .from("empleados")
    .select("id")
    .eq("org_id", org.id)
    .eq("nombre", "Empleado Demo")
    .maybeSingle();
  if (!empleado) {
    const { data, error } = await supabase
      .from("empleados")
      .insert({ org_id: org.id, nombre: "Empleado Demo" })
      .select()
      .single();
    if (error) throw error;
    empleado = data;
    console.log("empleado demo creado");
  } else {
    console.log("empleado demo ya existía (sin tocar su vínculo de dispositivo)");
  }

  console.log("\nListo para probar:");
  console.log("  Login:  demo@test.local / demo123456");
  console.log(`  Marcar: ${env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/marcar/cliente-prueba/${sucursal.id}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
