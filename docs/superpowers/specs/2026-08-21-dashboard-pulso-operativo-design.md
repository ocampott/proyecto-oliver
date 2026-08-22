# Dashboard "Pulso operativo del día" — diseño

## Contexto

Hoy `/` (`src/pages/HomePage.tsx`) es solo un menú de tarjetas hacia cada
módulo (Asistencia, Empleados, Sucursales, Horas, Turnos, RRHH), gateado por
plan/rol. No muestra ningún dato agregado ni operativo.

El pedido: agregar, arriba de ese menú, una sección de "pulso del día" —
información útil para chequear todas las mañanas sin entrar módulo por
módulo — con actualización en vivo de quién está marcando ahora mismo.

## Alcance

**Repo frontend** (`proyecto-oliver`): nueva sección en `HomePage.tsx`.
**Repo backend** (`proyecto-oliver-api`): una migración de una línea para
habilitar Realtime en la tabla `asistencia`. Sin cambios de código backend —
los inserts que ya hace `registrarMarca` (`src/lib/asistencia.ts:101-114`,
vía `POST /marcar/registrar`) alcanzan.

## Mecanismo de tiempo real

El cliente Supabase del frontend (`src/lib/supabase.ts`) ya mantiene una
sesión autenticada en todo momento — se usa hoy para firmar cada request REST
(`src/lib/api.ts:20-25`, `Authorization: Bearer <access_token>`). La tabla
`asistencia` ya tiene RLS scopeada por org (`org_id in (select org_id from
org_members where user_id = auth.uid())`, `supabase/migrations/0003_asistencia.sql`).

Esto habilita usar **Supabase Realtime** directo, sin construir infraestructura
de conexiones propia:

```ts
supabase
  .channel(`asistencia-org-${orgId}`)
  .on("postgres_changes",
    { event: "INSERT", schema: "public", table: "asistencia", filter: `org_id=eq.${orgId}` },
    (payload) => { /* actualizar estado derivado */ }
  )
  .subscribe();
```

RLS ya impide que una org reciba eventos de otra. No hay backend nuevo que
mantener (ni WS, ni SSE, ni manejo de reconexión propio — lo maneja el SDK
de Supabase).

**Migración necesaria** (`proyecto-oliver-api/supabase/migrations/`):
```sql
alter publication supabase_realtime add table asistencia;
```
Se aplica con `supabase db push` (CLI ya autorizado para este proyecto).

**Fallback si el canal se cae**: `supabase-js` reintenta la conexión solo.
Si el status del canal no es `SUBSCRIBED`, se muestra un indicador chico
("Actualizando…" / ícono de reconexión) en vez de fallar silenciosamente.
No se agrega polling de respaldo — no lo justifica el alcance de este widget.

## Widgets

Todos viven en un nuevo componente `src/components/dashboard/PulsoOperativo.tsx`,
montado arriba del menú de tarjetas existente en `HomePage.tsx`. La sección
completa se gatea con el mismo `soloGestion` (owner/admin, no `agent`) que ya
usan las tarjetas de Horas/Turnos/RRHH — los widgets 2 y 3 dependen de datos
de esos módulos, así que gatear solo por widget dejaría el dashboard
inconsistente con lo que el rol `agent` puede ver en el resto de la app.

### 1. Quién está adentro ahora (en vivo)
- Fuente inicial: `asistencia` de hoy (mismo patrón que `useAsistencia(desde, hasta)`
  con `desde = hasta = hoy`).
- Derivado: por `empleado_id`, si el último registro de hoy es `tipo: "entrada"`
  sin `salida` posterior → está adentro.
- Agrupado por sucursal.
- Se actualiza con cada evento Realtime: `tipo: "entrada"` agrega al empleado
  a la lista de "adentro"; `tipo: "salida"` lo saca.

### 2. Olvidaron marcar salida
- Fuente: `turnos` de una ventana reciente (ej. últimos 7 días, reusando
  el mismo endpoint que consume `useHoras`), filtrando `salida_at === null`
  y `entrada_at` **no** es de hoy (si fuera de hoy, ya está cubierto por el
  widget 1 como "adentro" legítimo).
- No tiene actualización realtime — se recalcula al cargar la página
  (es información de días anteriores, no cambia en vivo).

### 3. Ausencias / certificados pendientes hoy
- Fuente: `getAusencias(desde, hasta)` con `desde = hasta = hoy` (mismo hook
  que RRHH), filtrando las que solapan la fecha de hoy.
- Se marca con un ícono distinto las que tienen `certificado_pendiente: true`.

### 4. Contadores rápidos
- Empleados activos / total (de `useEmpleados()`, mismo criterio `activo`
  que ya filtra `EmpleadosPage`).
- Sucursales activas / total (de `useSucursales()`, mismo criterio `activa`).

## Componentes y archivos nuevos

- `src/components/dashboard/PulsoOperativo.tsx` — composición de los 4 widgets.
- `src/components/dashboard/useAsistenciaEnVivo.ts` — hook: fetch inicial +
  suscripción Realtime + estado derivado "quién está adentro". Aislado del
  resto para poder testear/leer la lógica de derivación por separado.
- `src/components/dashboard/useOlvidaronSalida.ts`, `useAusenciasHoy.ts` —
  hooks chicos, cada uno envolviendo el hook de datos existente (`useHoras`,
  `useAusencias`) con el filtro/derivación específica del widget.
- `src/pages/HomePage.tsx` — se le agrega `<PulsoOperativo />` arriba del
  grid de tarjetas existente. El resto de la página no cambia.

Todos los hooks de datos existentes (`useAsistencia`, `useHoras`,
`useAusencias`, `useEmpleados`, `useSucursales`) se reusan tal cual —
ninguno se modifica.

## Manejo de errores

- Si falla el fetch inicial de cualquier widget: ese widget muestra un
  estado de error contenido (no tira abajo el resto del dashboard ni la
  página) — mismo patrón que `ErrorPlan`/manejo de `isError` ya usado en
  otras páginas.
- Si el usuario no tiene sesión de Supabase activa (no debería pasar dentro
  de `ProtectedRoute`, pero por las dudas): el widget 1 simplemente no se
  suscribe y muestra el estado inicial sin live updates, sin crashear.

## Testing

Ninguno de los dos repos tiene suite de tests automatizados hoy (backend:
`"test": "echo \"Sin tests automatizados\""`; frontend: sin script de test).
Verificación manual en el navegador:
1. Levantar ambos dev servers, loguearse como owner/admin de una org con
   datos de prueba.
2. Confirmar que los 4 widgets cargan con datos reales.
3. Desde otra pestaña/dispositivo (o `MarcarPage`), registrar una marca de
   entrada/salida y confirmar que el widget 1 se actualiza sin recargar la
   página.
4. Verificar que un usuario de otra organización no recibe estos eventos
   (RLS) — abrir sesión de otra org en paralelo y confirmar que no ve
   cambios.
