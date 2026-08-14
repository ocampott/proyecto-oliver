# Migración a Vite — Etapa 2: Login + Home del panel

Fecha: 2026-08-14
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

Continuación de `docs/superpowers/specs/2026-08-13-vite-migration-design.md`
(roadmap §5). La Etapa 1 dejó `web/` (Vite+React+Tailwind) y `server/`
(Fastify) funcionando de punta a punta solo para el flujo público
`/marcar`. Esta etapa agrega el primer flujo protegido: login con sesión
real y el Home del panel, migrados desde Next.js.

El resto del panel (Sucursales, Empleados, Asistencia, Horas) sigue en
Next.js hasta las Etapas 3 y 4 — esta etapa no los toca.

## 2. Decisiones tomadas con el usuario

- **Nav durante la transición:** los links del nav a pantallas todavía no
  migradas (Asistencia, Horas, Empleados, Sucursales) aparecen
  deshabilitados con un tooltip ("todavía en el panel viejo"), en vez de
  redirigir a la app de Next.js. El usuario navega a mano a
  `localhost:3000` mientras dure la migración.
- **Separación `/api/me` vs `/api/org/current`:** `/api/me` es identidad
  (quién sos), `/api/org/current` es organización (a qué org pertenecés).
  Se separan porque las Etapas 3 y 4 van a necesitar el dato de la
  organización repetidamente en pantallas nuevas.

## 3. Arquitectura

### 3.1 Backend (`server/`)

Una ruta nueva, protegida con el mismo plugin `requireAuth` (Bearer token)
de la Etapa 1:

- **`GET /api/org/current`** → llama a `getCurrentOrg(request.user.id)`
  (ya portada en `server/src/lib/org.ts`, Etapa 1, sin uso hasta ahora).
  Devuelve `{id, name, slug, plan}`, o `404` si el usuario no tiene
  organización asociada.

No hay más rutas nuevas en esta etapa — no se toca `/api/marcar/*` ni
`/api/me`.

### 3.2 Frontend (`web/`)

- **`AuthProvider`** (`web/src/lib/auth.tsx`): contexto de React. Al
  montar, llama `supabase.auth.getSession()` para el estado inicial y se
  suscribe a `onAuthStateChange` para mantenerlo actualizado (login,
  logout, refresh de token). Expone `{ session, user, loading }` vía un
  hook `useAuth()`.
- **Cliente de Supabase** (`web/src/lib/supabase.ts`): `@supabase/supabase-js`
  directo (no `@supabase/ssr`, que es para sincronizar cookies con SSR —
  acá no aplica, es una SPA pura).
- **`ProtectedRoute`** (`web/src/components/ProtectedRoute.tsx`): mientras
  `loading` es `true` muestra un estado de carga; sin sesión redirige a
  `/login`; con sesión renderiza la ruta.
- **Cliente de API** (`web/src/lib/api.ts`, ya existe de la Etapa 1): se
  extiende para mandar `Authorization: Bearer <session.access_token>` en
  las rutas protegidas.
- **`/login`** (`web/src/pages/LoginPage.tsx`): form de email + contraseña,
  llama `supabase.auth.signInWithPassword` directo. Éxito → redirige a
  `/`. Error → mensaje "Email o contraseña incorrectos."
- **`/` — Home** (`web/src/pages/HomePage.tsx`): protegida. Pide
  `GET /api/org/current`; si hay org, muestra su nombre y las 4 tarjetas
  de acceso (Asistencia, Horas, Empleados, Sucursales); si no hay org,
  muestra el mensaje de "cuenta sin organización, contactá a soporte".
- **`PanelNav`** (`web/src/components/PanelNav.tsx`): nav con links a
  Inicio (activo), Asistencia/Horas/Empleados/Sucursales (deshabilitados
  con tooltip, per §2).
- **`PanelLayout`**: layout que envuelve las rutas protegidas del panel
  con `PanelNav` arriba — patrón equivalente al `(panel)/layout.tsx` de
  Next.js.
- **Rutas en `App.tsx`**: `/login` (pública), `/` (protegida, dentro de
  `PanelLayout`), `/marcar/:org/:sucursal` (ya existe, sin cambios),
  cualquier otra ruta → 404 (ya existe, sin cambios).

## 4. Alcance de la Etapa 2

### Dentro de alcance

- `GET /api/org/current` en `server/`.
- `AuthProvider`, `useAuth`, `ProtectedRoute`, cliente de Supabase en `web/`.
- `/login` y `/` (Home) completos, con el nav (activo + deshabilitados).
- Extender el cliente de API de `web/` para mandar el Bearer token.

### Fuera de alcance (sigue en Next.js hasta su etapa)

Sucursales, Empleados, Asistencia, Horas, y el panel de superadmin
(`/admin`).

### QA

Sin tests automatizados nuevos — verificación manual del usuario al
final, mismo patrón que la Etapa 1.

### Criterio de "listo"

- Login con `demo@test.local` funciona en `web/` y lleva al Home.
- Home muestra el nombre real de la organización y las 4 tarjetas.
- Recargar la página (F5) en `/` mantiene la sesión (no vuelve a pedir
  login).
- Cerrar sesión (si se agrega un botón de logout) o borrar la sesión del
  navegador y recargar `/` redirige a `/login`.
- Los links a pantallas no migradas están visiblemente deshabilitados.

## 5. Explícitamente fuera de alcance de este documento

- Botón de logout — el nav actual de Next.js no tiene uno; si se agrega,
  es una decisión de producto a confirmar con el usuario, no algo que
  esta etapa asuma.
- Etapas 3, 4 y 5 en detalle.
