# Migración de Next.js a Vite + Fastify + sistema de diseño propio

Fecha: 2026-08-13
Estado: aprobado, pendiente de plan de implementación (Etapa 1)

## 1. Contexto

El panel actual (Next.js App Router) funciona de punta a punta — Plan 1
(foundation multi-tenant) y Plan 2 (Asistencia multi-sucursal) están hechos
y probados manualmente por el usuario. Pero el diseño visual es Tailwind
neutro sin sistema de diseño: blanco y negro, tipografía default, sin
paleta de marca.

El usuario preparó un sistema de diseño propio (`Oliver sistema de diseño.pdf`)
— paleta, tipografía, componentes base y mockups de las pantallas clave — y
quiere que el sitio lo siga al pixel. En paralelo, pidió cambiar de stack:
dejar Next.js y pasar a **Vite**, agregando Tailwind y una librería de
componentes liviana, con el objetivo explícito de que el sitio sea rápido.

Next.js hoy no es solo el frontend: sirve las 15 rutas `/api/*`, hace los
chequeos de sesión server-side por página, y tiene middleware de auth.
Vite es solo un bundler de frontend — no trae nada de eso. Este documento
define a dónde va esa lógica y cómo se hace la migración sin dejar el panel
inutilizable en el camino.

## 2. Decisiones tomadas con el usuario

- **Backend:** un servidor Node propio (**Fastify**, no Express — más
  liviano, tipado nativo con TS, encaja con el objetivo de performance) que
  recibe casi 1:1 la lógica de negocio actual. Se descartó exponer Supabase
  directo al cliente (hubiera requerido reescribir RLS de solo-lectura a
  escritura, cambiando la capa de seguridad de datos, no solo el frontend).
  Se descartó mantener Next.js solo como servidor de API (dos stacks del
  mismo framework corriendo en paralelo sin necesidad).
- **Alcance:** migración **por etapas**, no todo junto. Cada etapa es un
  ciclo brainstorming → spec/plan → implementación propio.
- **Convivencia con Next.js:** **reemplazo directo**, no en paralelo. Cada
  pantalla se migra y se borra su equivalente en Next en el mismo momento
  (no se mantienen dos versiones vivas de la misma pantalla). El panel
  queda parcialmente en Next / parcialmente en Vite mientras dura la
  migración — aceptable porque es un proyecto en desarrollo, sin usuarios
  reales todavía, con QA manual del usuario en cada etapa.
- **Color de acento:** `#dc2626` (confirmado por el usuario, el PDF no
  traía el hex impreso).

## 3. Arquitectura resultante

### 3.1 Estructura de carpetas

```
proyecto-oliver/
├── web/       ← Vite + React + TS (reemplaza src/app/*, src/components)
├── server/    ← Fastify + TS (reemplaza src/app/api/*)
└── supabase/  ← sin cambios
```

Dos procesos en dev, cada uno con su propio `package.json`. Un script raíz
(`concurrently` o documentado como dos terminales) levanta ambos.

### 3.2 Backend (`server/`)

La lógica de negocio ya es agnóstica de Next.js — `asistencia.ts`,
`empleados.ts`, `sucursales.ts`, `otp.ts`, `nomina.ts`, `geo.ts` no
importan nada de `next/*` y se copian sin cambios. Lo que sí cambia:

- **Auth:** hoy `middleware.ts` lee la sesión de una cookie SSR y
  `requireOrg()` usa `createServerClient()` para leerla server-side. Nuevo:
  el SPA maneja la sesión con `supabase-js` client-side y manda
  `Authorization: Bearer <access_token>` en cada request; un plugin de
  Fastify valida ese token con `supabase.auth.getUser(token)` y reemplaza
  a `requireOrg()`.
- **Cookie de dispositivo** (`oliver_device`, vínculo dispositivo↔empleado
  en `/marcar`): sigue siendo httpOnly, pero se maneja con
  `@fastify/cookie` en vez de `next/headers`.
- **CORS:** necesario porque `web` y `server` corren en puertos distintos
  en dev (y probablemente dominios/subdominios distintos en producción,
  decisión que queda para cuando se llegue a esa etapa de deploy).

### 3.3 Frontend (`web/`)

- **React Router** — reemplaza el middleware de Next para rutas
  protegidas: un `<ProtectedRoute>` que lee la sesión de `supabase-js`
  client-side y redirige a `/login` si no hay sesión (equivalente al
  redirect server-side de hoy, pero resuelto en el cliente).
- **TanStack Query** — reemplaza el patrón manual
  `useState`/`useEffect`/`fetch` repetido en cada `*-client.tsx` actual.
- **shadcn/ui** — la librería de componentes. No es una dependencia con
  bundle propio: los componentes (Radix UI + Tailwind) se copian al repo,
  así que el peso de runtime es exactamente lo que se usa, y se puede
  reskinear al 100% con los tokens del sistema de diseño sin pelear contra
  un lenguaje visual ajeno (a diferencia de AntD/MUI). Se trae solo el
  subset que pide el PDF: **Button, Input, Card, Badge, Table**.
- **Lucide** — set de íconos, coincide con lo que pide el PDF ("solo
  Lucide, solo tinta o acento, sin ilustraciones") y es el default de
  shadcn.
- **Vitest** sigue siendo el test runner (ya es nativo de Vite, de hecho
  con menos fricción que la integración actual con Next).

## 4. Sistema de diseño (del PDF, tal cual)

### 4.1 Tokens de color

CSS custom properties (no clases Tailwind hardcodeadas), para que el
acento sea swappeable por organización en el futuro sin tocar el resto del
sistema:

```css
--color-bg: #f3f2f2;
--color-surface: #eae9e9;
--color-text: #201e1d;
--color-accent: #dc2626;
```

### 4.2 Tipografía

Familia **Archivo** (Google Fonts). Escala:

| Estilo | Tamaño | Peso |
|---|---|---|
| H1 | 42px | 800 |
| H2 | 32px | 800 |
| H4 | 20px | 800 |
| Body | 15px | 400 |
| Caption | 11px, uppercase | — |

### 4.3 Sistema mono-acento

El PDF es explícito: **un solo color de marca**. Corrección post-Etapa 1
(el whole-branch review detectó que esta sección, tal como estaba escrita
antes, contradecía el propio PDF y lo que terminamos construyendo — el
usuario confirmó viendo las pantallas reales que el comportamiento correcto
es el de abajo, no el que describía la versión anterior de este párrafo):

**Badges de estado** (Aprobado / Pendiente / Rechazado / Sin vincular) NO
usan una paleta semántica nueva (nada de verde-éxito, amarillo-pendiente).
Se resuelven con:

- **Tinta llena** → resuelto / activo.
- **Contorno** (tinta, sin relleno) → pendiente.
- **Accent (rojo)** → rechazado / error / fuera de rango.

**CTAs primarios** (botones de acción principal — "Continuar", "Marcar
entrada", "Vincular", etc.) SÍ usan el accent como color por default,
según el propio PDF (sección 03, mockups del marcado público). El accent
no es exclusivo de "lo que pide atención" en toda la UI — es el único
color de marca, y cumple dos roles distintos según el componente: en
`Badge` marca rechazo/error: en `Button`, es el CTA principal.

Esto se modela como variantes de `Badge` (`filled` / `outline` / `accent`)
y de `Button` (`default` / `outline` / `accent` / `ghost`), no como una
paleta de colores nueva.

### 4.4 Componentes base (del PDF, sección 02)

Botones (filled negro, outline, texto/ghost, y la variante grande de CTA
tipo "Marcar entrada"), Inputs (texto simple, e input de código de 6
dígitos con tracking ancho y centrado — igual al que ya existe hoy en
`marcar-client.tsx`), Tarjetas (título uppercase caption + contenido),
Badges de estado (los 4 de arriba), Tabla (header uppercase, filas con
borde inferior).

## 5. Roadmap de migración

La migración completa son 5 etapas. Cada una se brainstormea, especifica e
implementa por separado cuando le toca el turno — este documento solo
detalla la Etapa 1.

1. **Etapa 1 (esta spec):** Fundaciones (`web/` + `server/` + sistema de
   diseño aplicado a los componentes base) + flujo público `/marcar`
   completo, de punta a punta.
2. **Etapa 2:** Login + Home del panel (primer flujo de auth client-side
   de punta a punta).
3. **Etapa 3:** Sucursales + Empleados (altas, QR, generación de código
   OTP).
4. **Etapa 4:** Asistencia + Horas (tablas, filtros, rechazados).
5. **Etapa 5:** Baja total de Next.js — borrar `src/`, `next.config`,
   `middleware.ts`, dependencias de `next` / `@supabase/ssr` del
   `package.json` raíz.

## 6. Alcance de la Etapa 1

### Dentro de alcance

- Scaffold de `web/`: Vite + React + TS + Tailwind con los tokens de §4.1,
  fuente Archivo cargada, shadcn/ui inicializado con Button, Input, Card,
  Badge, Table ya reskineados según §4.3–4.4.
- Scaffold de `server/`: Fastify + TS, plugin de auth (Bearer token →
  `supabase.auth.getUser()`), `@fastify/cookie`, CORS configurado para que
  `web` le hable a `server` en dev.
- Flujo público `/marcar/:org/:sucursal` completo, con las 5 pantallas del
  PDF (identificarse → confirmar → vincular → marcar con los dos botones →
  éxito / rechazo). Backend: se portan `identificar`, `verificar`,
  `registrar` de `src/app/api/marcar/*` a rutas de Fastify, reutilizando
  `empleados.ts`, `asistencia.ts`, `otp.ts`, `nomina.ts`, `geo.ts` y una
  versión adaptada de `device-token.ts`.
- Una vez verificado manualmente, se borra el equivalente viejo:
  `src/app/marcar/`, `src/app/api/marcar/*`.

### Fuera de alcance (queda en Next.js sin tocar hasta su etapa)

Login, home, sucursales, empleados, asistencia, horas.

### QA

Sin suite de tests automatizados nueva — verificación manual del usuario
al final de la etapa, con pasos concretos entregados al cierre (mismo
patrón que se usó para cerrar el Plan 2 de Asistencia).

### Criterio de "listo"

- `web/` levanta con `npm run dev` (Vite) de forma independiente.
- `server/` levanta con `npm run dev` (Fastify) de forma independiente.
- `/marcar/:org/:sucursal` funciona de punta a punta contra los datos demo
  reales (org "Cliente de prueba", sucursal "Casa Central"), visualmente
  igual al mockup del PDF.
- `src/app/marcar/` y `src/app/api/marcar/*` (Next.js) quedan borrados.
- README actualizado con el flujo de dev de dos procesos.

## 7. Explícitamente fuera de alcance de este documento

- Topología de deploy en producción (dominios/subdominios de `web` vs
  `server`, hosting) — se decide cuando el panel esté migrado por completo
  o cuando haga falta deployar antes de eso. **Restricción a tener en
  cuenta en esa decisión** (detectada en el whole-branch review de la
  Etapa 1): la cookie `oliver_device` usa `SameSite=Lax`, que funciona
  same-site (subdominios de un mismo dominio registrable, ej.
  `app.oliver.com` + `api.oliver.com`) pero se cae silenciosamente si
  `web` y `server` terminan en dominios registrables distintos (ej. un
  proveedor para cada uno). O se deployan bajo el mismo dominio
  registrable, o la cookie pasa a `SameSite=None; Secure`.
- Theming multi-tenant real (organización eligiendo su propio accent) —
  el token queda preparado como CSS variable para esto, pero no se
  construye la feature ahora.
- Etapas 2 a 5 en detalle — cada una tiene su propio ciclo de brainstorming
  cuando le toque.
