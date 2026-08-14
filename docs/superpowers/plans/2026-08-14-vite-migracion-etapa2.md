# Migración a Vite — Etapa 2 (Login + Home) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el primer flujo protegido de `web/`: login con sesión real de Supabase y el Home del panel, migrados desde Next.js, sin tocar el resto del panel todavía.

**Architecture:** `server/` gana una ruta protegida (`GET /api/org/current`) que resuelve la organización del usuario logueado. `web/` gana un `AuthProvider` que mantiene la sesión de Supabase en contexto de React, un `ProtectedRoute` que gatea rutas según esa sesión, y las páginas `/login` y `/` (Home). El cliente de API existente se extiende para mandar el token de sesión como `Authorization: Bearer`.

**Tech Stack:** `@supabase/supabase-js` (cliente, no `@supabase/ssr`) en `web/`. React Context para el estado de auth. Sin librerías nuevas de UI — se reusan los componentes de la Etapa 1 (`Button`, `Input`, `Card`).

**Spec:** `docs/superpowers/specs/2026-08-14-vite-migration-etapa2-design.md`

## Global Constraints

- `@supabase/supabase-js@2.112.3` (misma versión que el resto del proyecto).
- **Esta etapa NO borra nada de Next.js.** A diferencia de la Etapa 1
  (donde `/marcar` era autocontenido), `/login` de Next.js sigue siendo
  necesario: Sucursales, Empleados, Asistencia y Horas todavía viven en
  Next.js y dependen de su propio `middleware.ts` + `/login` hasta que
  esas pantallas migren (Etapas 3 y 4). Borrarlo ahora rompería el acceso
  a esas páginas. El Home viejo de Next.js (`src/app/(panel)/page.tsx`)
  tampoco se toca por el mismo motivo (el login de Next.js redirige ahí
  después de autenticar). Esto se revisa recién en la Etapa 5, cuando ya
  no quede nada en Next.js que dependa de ellos.
- Nav durante la transición: los links a pantallas no migradas
  (Asistencia, Horas, Empleados, Sucursales) van deshabilitados con
  tooltip "Todavía en el panel viejo (localhost:3000)" — mismo texto en
  el nav y en las tarjetas del Home.
- `/api/org/current` es una ruta separada de `/api/me` (identidad vs.
  organización) — no se fusionan.
- Sin tests automatizados nuevos (constraint del proyecto) — verificación
  manual vía curl/build, y al final una pasada del usuario en el
  navegador.
- Valores exactos de conexión a Supabase (nube, ya en uso desde la sesión
  anterior — el anon key es público por diseño, seguro de commitear):
  `VITE_SUPABASE_URL=https://utgjmreanqbzncvykqgd.supabase.co`
  `VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z2ptcmVhbnFiem5jdnlrcWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzIwMjMsImV4cCI6MjEwMjMwODAyM30.BPBrpWkCZ25_qnrqZzflQOLY89VktjUTV3djI6Kgovw`

---

## Task 1: `GET /api/org/current` en `server/`

**Files:**
- Create: `server/src/routes/org.ts`
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `requireAuth` (`server/src/plugins/auth.ts`, Etapa 1), `getCurrentOrg` (`server/src/lib/org.ts`, ya portada en la Etapa 1, sin uso hasta ahora).
- Produces: la ruta HTTP, consumida por `web/src/lib/api.ts` en la Task 4.

- [ ] **Step 1: Crear `server/src/routes/org.ts`**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { getCurrentOrg } from "../lib/org.js";

export async function orgRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/org/current", { preHandler: requireAuth }, async (request, reply) => {
    const org = await getCurrentOrg(request.user!.id);
    if (!org) {
      return reply.code(404).send({
        error: "Tu cuenta todavía no está asociada a ninguna organización.",
      });
    }
    return org;
  });
}
```

- [ ] **Step 2: Registrar la ruta en `server/src/index.ts`**

Reemplazar el contenido completo de `server/src/index.ts` por:

```ts
import Fastify from "fastify";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import { env } from "./env.js";
import { meRoutes } from "./routes/me.js";
import { orgRoutes } from "./routes/org.js";
import { marcarRoutes } from "./routes/marcar.js";

const app = Fastify({ logger: true });

await app.register(cors, { origin: env.corsOrigin, credentials: true });
await app.register(cookie);

app.get("/api/health", async () => ({ ok: true }));

await app.register(meRoutes);
await app.register(orgRoutes);
await app.register(marcarRoutes);

app.setErrorHandler((error, request, reply) => {
  request.log.error(error);
  reply.status(500).send({ error: "Algo salió mal. Probá de nuevo." });
});

app.listen({ port: env.port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
```

- [ ] **Step 3: Verificar manualmente**

El server de `tsx watch` recarga solo si ya está corriendo (`cd server && npm run dev`, si no está levantado). Con el usuario demo real:

```bash
echo "--- sin token ---"
curl -s -i http://localhost:3001/api/org/current | head -1

echo "--- con token del usuario demo ---"
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')
curl -s http://localhost:3001/api/org/current -H "Authorization: Bearer $TOKEN"
echo
```

Esperado: la primera devuelve `401`; la segunda devuelve `200` con
`{"id":"...","name":"Cliente de prueba","slug":"cliente-prueba","plan":"trial"}`.

- [ ] **Step 4: Commit**

```bash
git add server/src/routes/org.ts server/src/index.ts
git commit -m "feat(server): GET /api/org/current"
```

---

## Task 2: Cliente de Supabase + `AuthProvider` en `web/`

**Files:**
- Create: `web/src/lib/supabase.ts`
- Create: `web/src/lib/auth.tsx`
- Modify: `web/.env.example`
- Create: `web/.env.local` (no versionado)
- Modify: `web/package.json` (nueva dependencia)

**Interfaces:**
- Produces: `supabase` (cliente, `web/src/lib/supabase.ts`), `AuthProvider`, `useAuth(): { session, user, loading }` (`web/src/lib/auth.tsx`) — consumidos por `ProtectedRoute` (Task 3), `web/src/lib/api.ts` (Task 4), `LoginPage` (Task 5), `App.tsx` (Tasks 5 y 7).

- [ ] **Step 1: Instalar `@supabase/supabase-js`**

```bash
cd web
npm install @supabase/supabase-js@2.112.3
```

- [ ] **Step 2: Agregar las variables a `.env.example` y crear `.env.local`**

Reemplazar `web/.env.example`:
```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Crear `web/.env.local` (los valores reales están en Global Constraints):
```
VITE_API_URL=http://localhost:3001
VITE_SUPABASE_URL=https://utgjmreanqbzncvykqgd.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0Z2ptcmVhbnFiem5jdnlrcWdkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY3MzIwMjMsImV4cCI6MjEwMjMwODAyM30.BPBrpWkCZ25_qnrqZzflQOLY89VktjUTV3djI6Kgovw
```

- [ ] **Step 3: Crear `web/src/lib/supabase.ts`**

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

- [ ] **Step 4: Crear `web/src/lib/auth.tsx`**

```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
```

- [ ] **Step 5: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores. Sin consumidor todavía (`AuthProvider` no está montado en `App.tsx` hasta la Task 5) — es esperable, se conecta en una task posterior.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/supabase.ts web/src/lib/auth.tsx web/.env.example web/package.json web/package-lock.json
git commit -m "feat(web): cliente de Supabase + AuthProvider"
```

---

## Task 3: `ProtectedRoute`

**Files:**
- Create: `web/src/components/ProtectedRoute.tsx`

**Interfaces:**
- Consumes: `useAuth` (Task 2).
- Produces: `ProtectedRoute` — consumido por `App.tsx` en la Task 7.

- [ ] **Step 1: Crear `web/src/components/ProtectedRoute.tsx`**

```tsx
import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <p className="text-text/60">Cargando...</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
```

- [ ] **Step 2: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores. Sin consumidor todavía (se conecta en la Task 7).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/ProtectedRoute.tsx
git commit -m "feat(web): ProtectedRoute"
```

---

## Task 4: Bearer token en el cliente de API + `getOrgActual()`

**Files:**
- Modify: `web/src/lib/api.ts`

**Interfaces:**
- Consumes: `supabase` (Task 2).
- Produces: `getOrgActual(): Promise<Organization>`, tipo `Organization` — consumidos por `HomePage` en la Task 7. `request()` ahora manda el Bearer token en toda request (afecta también a las llamadas de `/marcar/*` ya existentes, sin cambiar su comportamiento: esas rutas son públicas y no leen el header).

- [ ] **Step 1: Reemplazar el contenido completo de `web/src/lib/api.ts`**

```ts
import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (init?.headers) Object.assign(headers, init.headers);
  if (session) headers["Authorization"] = `Bearer ${session.access_token}`;

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error ?? "Algo salió mal. Probá de nuevo.");
  }
  return body as T;
}

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
}

export function getOrgActual(): Promise<Organization> {
  return request("/api/org/current");
}

export interface EstadoMarcado {
  sucursalNombre: string;
  empleadoNombre: string | null;
}

export function getEstadoMarcado(org: string, sucursal: string): Promise<EstadoMarcado> {
  return request(
    `/api/marcar/estado?org=${encodeURIComponent(org)}&sucursal=${encodeURIComponent(sucursal)}`
  );
}

export interface IdentificarResponse {
  empleadoId?: string;
  sugerencia?: string;
}

export function identificar(
  orgSlug: string,
  sucursalId: string,
  nombre: string
): Promise<IdentificarResponse> {
  return request("/api/marcar/identificar", {
    method: "POST",
    body: JSON.stringify({ orgSlug, sucursalId, nombre }),
  });
}

export interface VerificarResponse {
  ok: true;
  nombre: string;
}

export function verificar(empleadoId: string, code: string): Promise<VerificarResponse> {
  return request("/api/marcar/verificar", {
    method: "POST",
    body: JSON.stringify({ empleadoId, code }),
  });
}

export interface RegistrarResponse {
  ok: true;
  tipo: "entrada" | "salida";
  hora: string;
}

export function registrarMarca(
  sucursalId: string,
  tipo: "entrada" | "salida",
  lat: number,
  lon: number
): Promise<RegistrarResponse> {
  return request("/api/marcar/registrar", {
    method: "POST",
    body: JSON.stringify({ sucursalId, tipo, lat, lon }),
  });
}
```

- [ ] **Step 2: Verificar que compila y que `/marcar` sigue funcionando**

```bash
cd web
npm run build
```

El flujo de `/marcar` de la Etapa 1 no debería regresionar — sigue sin sesión (usuario público), así que el header `Authorization` simplemente no se agrega (rama `if (session)`).

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/api.ts
git commit -m "feat(web): Bearer token en el cliente de API + getOrgActual()"
```

---

## Task 5: `LoginPage` + ruta `/login`

**Files:**
- Create: `web/src/pages/LoginPage.tsx`
- Modify: `web/src/App.tsx`

**Interfaces:**
- Consumes: `supabase` (Task 2), `Button`/`Input`/`Card` (Etapa 1).
- Produces: la ruta `/login` renderizada — consumida por `ProtectedRoute` (que redirige ahí) desde la Task 7.

- [ ] **Step 1: Crear `web/src/pages/LoginPage.tsx`**

```tsx
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError("Email o contraseña incorrectos.");
      return;
    }
    navigate("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-8">
      <Card className="w-full max-w-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h1 className="text-[20px] font-extrabold text-text">Iniciar sesión</h1>
          <p className="text-[15px] text-text/60">
            Ingresá con tu email y contraseña para acceder al panel.
          </p>
          <Input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            type="password"
            required
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <p className="text-[15px] text-accent">{error}</p>}
          <Button type="submit" variant="accent" size="lg" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
```

- [ ] **Step 2: Conectar `AuthProvider` y la ruta `/login` en `web/src/App.tsx`**

Reemplazar el contenido completo de `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import MarcarPage from "./pages/MarcarPage";
import LoginPage from "./pages/LoginPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
          <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Verificar manualmente**

```bash
cd web
npm run build
```

La verificación funcional del login completo (submit del form, redirección) se hace en la Task 7 junto con el Home — hasta entonces, loguearse acá redirige a `/`, que todavía cae en el catch-all "Página no encontrada" (esperado, no es un bug).

- [ ] **Step 4: Commit**

```bash
git add web/src/pages/LoginPage.tsx web/src/App.tsx
git commit -m "feat(web): LoginPage + ruta /login"
```

---

## Task 6: `PanelNav` + `PanelLayout`

**Files:**
- Create: `web/src/components/PanelNav.tsx`
- Create: `web/src/components/PanelLayout.tsx`

**Interfaces:**
- Produces: `PanelNav`, `PanelLayout` — consumidos por `App.tsx` en la Task 7.

- [ ] **Step 1: Crear `web/src/components/PanelNav.tsx`**

```tsx
import { NavLink } from "react-router-dom";

interface NavItem {
  href: string;
  label: string;
  disabled?: boolean;
}

const LINKS: NavItem[] = [
  { href: "/", label: "Inicio" },
  { href: "/asistencia", label: "Asistencia", disabled: true },
  { href: "/horas", label: "Horas", disabled: true },
  { href: "/empleados", label: "Empleados", disabled: true },
  { href: "/sucursales", label: "Sucursales", disabled: true },
];

const TOOLTIP_DESHABILITADO = "Todavía en el panel viejo (localhost:3000)";

export function PanelNav() {
  return (
    <nav className="border-b border-text/10 bg-surface px-8 py-3">
      <div className="flex gap-4 text-[15px]">
        {LINKS.map((item) =>
          item.disabled ? (
            <span key={item.href} title={TOOLTIP_DESHABILITADO} className="cursor-not-allowed text-text/40">
              {item.label}
            </span>
          ) : (
            <NavLink
              key={item.href}
              to={item.href}
              end
              className={({ isActive }) =>
                isActive ? "font-extrabold text-text" : "text-text hover:underline"
              }
            >
              {item.label}
            </NavLink>
          )
        )}
      </div>
    </nav>
  );
}

export { TOOLTIP_DESHABILITADO };
```

- [ ] **Step 2: Crear `web/src/components/PanelLayout.tsx`**

```tsx
import type { ReactNode } from "react";
import { PanelNav } from "./PanelNav";

export function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PanelNav />
      {children}
    </>
  );
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

Esperado: sin errores. Sin consumidor todavía (se conecta en la Task 7).

- [ ] **Step 4: Commit**

```bash
git add web/src/components/PanelNav.tsx web/src/components/PanelLayout.tsx
git commit -m "feat(web): PanelNav + PanelLayout"
```

---

## Task 7: `HomePage` + rutas finales + verificación E2E

**Files:**
- Create: `web/src/pages/HomePage.tsx`
- Modify: `web/src/App.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `getOrgActual`, `Organization` (Task 4); `ProtectedRoute` (Task 3); `PanelLayout` (Task 6); `Card` (Etapa 1); `TOOLTIP_DESHABILITADO` (Task 6).

- [ ] **Step 1: Crear `web/src/pages/HomePage.tsx`**

```tsx
import { useEffect, useState } from "react";
import { Card } from "../components/ui/card";
import { getOrgActual, type Organization } from "../lib/api";
import { TOOLTIP_DESHABILITADO } from "../components/PanelNav";

const ACCESOS = [
  { href: "/asistencia", label: "Asistencia", detalle: "Registros de entrada/salida e intentos rechazados" },
  { href: "/horas", label: "Horas", detalle: "Turnos y horas trabajadas por empleado" },
  { href: "/empleados", label: "Empleados", detalle: "Nómina, vínculo de dispositivos y códigos" },
  { href: "/sucursales", label: "Sucursales", detalle: "Ubicaciones, geocercas y códigos QR" },
];

export default function HomePage() {
  const [org, setOrg] = useState<Organization | null>(null);
  const [sinOrg, setSinOrg] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getOrgActual()
      .then(setOrg)
      .catch(() => setSinOrg(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-text/60">Cargando...</p>
      </main>
    );
  }

  if (sinOrg || !org) {
    return (
      <main className="p-8">
        <p className="text-text">
          Tu cuenta todavía no está asociada a ninguna organización. Contactá a soporte.
        </p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="text-[32px] font-extrabold text-text">{org.name}</h1>
      <div className="mt-6 grid max-w-3xl gap-4 sm:grid-cols-2">
        {ACCESOS.map((a) => (
          <Card key={a.href} title={TOOLTIP_DESHABILITADO} className="cursor-not-allowed opacity-60">
            <h2 className="text-[15px] font-extrabold text-text">{a.label}</h2>
            <p className="mt-1 text-[15px] text-text/60">{a.detalle}</p>
          </Card>
        ))}
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Conectar todo en `web/src/App.tsx`**

Reemplazar el contenido completo de `web/src/App.tsx`:

```tsx
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./lib/auth";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { PanelLayout } from "./components/PanelLayout";
import MarcarPage from "./pages/MarcarPage";
import LoginPage from "./pages/LoginPage";
import HomePage from "./pages/HomePage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <PanelLayout>
                  <HomePage />
                </PanelLayout>
              </ProtectedRoute>
            }
          />
          <Route path="/marcar/:org/:sucursal" element={<MarcarPage />} />
          <Route path="*" element={<div className="p-8">Página no encontrada.</div>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd web
npm run build
```

- [ ] **Step 4: Checklist manual (E2E, para el usuario en el navegador)**

Con `web/` y `server/` corriendo (`npm run dev` en cada uno):

1. Abrir `http://localhost:5173/` sin sesión → debe redirigir a `/login`.
2. Loguearse con `demo@test.local` / `demo123456` → debe redirigir a `/` y mostrar "Cliente de prueba" como título.
3. Confirmar que las 4 tarjetas (Asistencia, Horas, Empleados, Sucursales) se ven pero no son clickeables, con tooltip al pasar el mouse.
4. Confirmar que el nav de arriba tiene "Inicio" activo y los otros 4 links en gris, no clickeables.
5. Recargar la página (F5) → debe seguir en `/` mostrando el Home (la sesión persiste), no volver a pedir login.
6. Abrir `http://localhost:5173/login` con la sesión activa → decisión de diseño: **no** redirige automáticamente a `/` (a diferencia de Next.js) — esto es aceptable para esta etapa, no estaba en el criterio de "listo" del spec; anotarlo como posible mejora de una etapa futura si molesta en el uso real.
7. Confirmar que `http://localhost:3000/login` (Next.js, viejo) sigue funcionando igual que antes — no debería haber cambiado nada ahí.

Esperar la confirmación del usuario antes de continuar al Step 5.

- [ ] **Step 5: Actualizar el README**

En la sección "## Migración a Vite (en curso)" de `README.md`, reemplazar el párrafo que empieza con "**Estado actual:**" por:

```markdown
**Estado actual:** el flujo público `/marcar` y el login + home del panel
ya viven en `web/` + `server/`. El resto del panel (sucursales,
empleados, asistencia, horas) sigue en Next.js — incluyendo su propio
`/login`, que se mantiene con vida en paralelo (no se borra todavía)
porque esas pantallas lo siguen necesitando hasta que también migren.
```

- [ ] **Step 6: Commit**

```bash
git add web/src/pages/HomePage.tsx web/src/App.tsx README.md
git commit -m "feat(web): HomePage + login/home de punta a punta (Etapa 2)"
```

---

## Al terminar la Etapa 2

- `/login` y `/` (Home) funcionan de punta a punta en `web/` + `server/`, con sesión real de Supabase.
- Nada se borró de Next.js — su `/login` y home siguen funcionando igual, todavía en uso por las pantallas no migradas.
- Quedan pendientes las Etapas 3 a 5 (spec de la Etapa 1, §5) — cada una arranca con su propio brainstorming cuando el usuario lo pida.
