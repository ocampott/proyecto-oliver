function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable de entorno ${name}`);
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3001),
  corsOrigin: process.env.CORS_ORIGIN ?? "http://localhost:5173",
  marcarBaseUrl: process.env.MARCAR_BASE_URL ?? "http://localhost:5173",
  supabaseUrl: required("SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  // Key de servidor para Places API (New), restringida por IP. Opcional al
  // boot para no romper dev sin mapas; el endpoint falla con mensaje claro.
  googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY ?? "",
  nodeEnv: process.env.NODE_ENV ?? "development",
};
