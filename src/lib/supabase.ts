import { createClient } from "@supabase/supabase-js";

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
// El preview puede exponer la anon key antes de sincronizar la URL. La URL
// es pública y también queda respaldada por el proyecto Supabase del token.
const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ??
  "https://utgjmreanqbzncvykqgd.supabase.co";

if (!supabaseAnonKey) {
  throw new Error("Falta VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
