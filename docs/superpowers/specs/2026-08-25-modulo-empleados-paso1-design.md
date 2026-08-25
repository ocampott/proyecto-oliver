# Módulo Empleados — Paso 1 (identidad y estado)

Fecha: 2026-08-25
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

`/Users/tomasocampo/Downloads/MODULO-EMPLEADOS.md` (documento externo,
complemento del roadmap principal) diagnostica tres problemas de fondo en
la tabla `empleados` actual (`id · org_id · nombre · celular ·
device_token · activo · created_at`):

1. No hay identificador confiable de la persona — todo se matchea por
   `nombre` en texto libre (`src/lib/nomina.ts` en `proyecto-oliver-api`).
2. `empleados` no tiene `sucursal_id` — no se puede responder "¿cuántos
   empleados tiene la sucursal Norte?" sin mirar quién marcó ahí.
3. `activo: boolean` no guarda historia — sobrescribe categoría/sucursal/
   estado sin dejar rastro, y no distingue "de licencia" de "ausente".

El documento propone una estructura completa en 6 tablas nuevas (datos de
identidad, contacto, `periodos_laborales`, `empleado_condiciones` con
vigencia, documentos, familiares) organizada en 4 pasos. Es demasiado
grande para una sola spec — decidido con el usuario tratarla como
sub-proyectos independientes, cada uno con su propia spec.

**Esta spec cubre solo el Paso 1** (lista exacta de la sección 8 del
documento — no la tabla completa de la sección 4): CUIL con validación,
apellido/nombre separados, `fecha_ingreso`, `sucursal_id`, estados en vez
de booleano, celular normalizado. Es el paso que el documento marca como
el que "desbloquea todo lo demás" y coincide con la Fase F1 del roadmap
principal.

`dni`, `fecha_nacimiento`, `genero`, `nacionalidad`, `foto_url`,
`legajo_numero`, `periodos_laborales`, `empleado_condiciones` con
vigencia, documentos y familiares quedan explícitamente fuera — son
Paso 2/3/4, con spec propia cuando les toque.

## 2. Decisiones tomadas con el usuario

- **CUIL nullable + aviso**, no obligatorio desde el día 1. Los
  empleados sin CUIL generan la alerta "CUIL faltante" (ver sección 5)
  hasta que alguien lo completa. Cuando SÍ se carga, se valida el
  dígito verificador (módulo 11) — no se acepta cualquier string de 11
  dígitos.
- **Split apellido/nombre: auto-split + revisión.** La migración toma
  la última palabra de `nombre` como apellido y el resto como nombre
  (heurística simple), y deja un listado para que el admin revise los
  casos raros (apellidos compuestos). No se le pide al cliente que
  recargue a mano.
- **Estados y marcado: `activo` y `de_licencia` pueden marcar,
  `suspendido` y `baja` no.** Alguien de licencia que vuelve antes
  (corta la licencia) tiene que poder seguir marcando sin que un admin
  tenga que reactivarlo — solo se le apagan las alertas de ausencia
  mientras dure la licencia.
- **`estado` como `text + check`, no un enum de Postgres** — mismo
  patrón que `asistencia.tipo` y `asistencia_rechazada.motivo`. Un
  `ALTER TYPE` para agregar un estado nuevo el día de mañana es mucho
  más caro que ampliar un `check`.
- **`activo` se reemplaza por `estado`, no convive con él.** Sin
  columna de compatibilidad ni flag — backend y frontend de este
  producto se despliegan juntos, así que todos los call-sites se
  actualizan en el mismo cambio.
- **`sucursal_id` en `empleados` es la sucursal "de base"**, distinta
  del `sucursal_id` opcional en `horarios_empleado` (que es por franja
  horaria, ya existente desde el módulo de Turnos). Un empleado puede
  tener horarios en más de una sucursal; `empleados.sucursal_id` es
  solo el dato administrativo "a qué sucursal pertenece", usado para
  filtros y conteos.

## 3. Arquitectura

### 3.1 Base de datos (`proyecto-oliver-api/supabase/migrations/`)

**Migración A — `0011_empleados_identidad.sql`:**

```sql
alter table empleados
  add column apellido text,
  add column cuil text,
  add column fecha_ingreso date,
  add column sucursal_id uuid references sucursales (id) on delete set null,
  add column estado text not null default 'activo'
    check (estado in ('activo', 'de_licencia', 'suspendido', 'baja'));

-- Único por org, pero solo entre los valores no nulos — permite que
-- muchos empleados no tengan CUIL todavía sin chocar entre sí.
create unique index empleados_cuil_key on empleados (org_id, cuil) where cuil is not null;

-- Backfill: activo=true → 'activo', activo=false → 'baja' (el mapeo más
-- cercano al significado que tenía activo=false hasta ahora).
update empleados set estado = case when activo then 'activo' else 'baja' end;
```

`activo` **no se dropea en esta misma migración** — queda una migración B
corta (`0012_empleados_drop_activo.sql`, `alter table empleados drop
column activo;`) que se aplica después de verificar en producción que el
backfill de `estado` quedó bien. Cambio de schema hard-to-reverse, mejor
en dos pasos chicos que en uno grande.

**Script one-off — `proyecto-oliver-api/scripts/split-apellido.js`:**
Recorre `empleados`, aplica la heurística (última palabra → `apellido`,
resto → `nombre`), hace el `update` y imprime una tabla `id · nombre
original · apellido · nombre` para revisión manual de los casos con
apellidos compuestos.

### 3.2 Backend (`proyecto-oliver-api/`)

**`src/lib/cuil.ts`** (nuevo, puro, sin DB — mismo patrón que
`geo.ts`/`otp-logica.ts` de la limpieza de tests reciente):

- `validarCuil(cuil: string): boolean` — dígito verificador módulo 11.
  Test con CUILs reales válidos e inválidos (`cuil.test.ts`).

**`src/lib/celular.ts`** (nuevo, puro):

- `normalizarCelular(input: string): string | null` — formato
  `+54 9 <área> <número>`; `null` si no es reconocible como celular
  argentino. Test con formatos comunes de entrada (con/sin 0, con/sin
  15, con/sin espacios) (`celular.test.ts`).

**`src/lib/empleados.ts`** (existente, se toca):

- `Empleado` gana `apellido: string | null`, `cuil: string | null`,
  `fecha_ingreso: string | null`, `sucursal_id: string | null`,
  `estado: "activo" | "de_licencia" | "suspendido" | "baja"`. Pierde
  `activo`.
- `createEmpleado`/`createEmpleadoConLimite`/`updateEmpleado` reciben
  los campos nuevos; `celular` pasa por `normalizarCelular` antes de
  guardar.
- `countEmpleadosActivos` pasa de `eq("activo", true)` a
  `neq("estado", "baja")` — de licencia y suspendido siguen ocupando
  un lugar del plan (siguen siendo personal), solo baja libera el
  cupo. **Nota para el rollout:** esto puede correr el conteo de
  clientes que hoy tienen gente en `activo=false` por otro motivo que
  "baja" — no hay forma de saberlo sin mirar los datos reales al
  migrar.
- `buscarEnNomina` arma `${apellido ?? ""} ${nombre}`.trim() antes de
  pasarlo a `nomina.ts` (el matching ya es order-independent —
  `normalizeNombre` ordena las palabras — así que concatenar alcanza,
  sin tocar `nomina.ts`).
- `getEmpleadoByToken`/`getEmpleadoByDeviceToken`/`buscarEnNomina`
  cambian el filtro de `eq("activo", true)` a
  `.in("estado", ["activo", "de_licencia"])`.

**`src/routes/empleados.schemas.ts`** (nuevo) — zod, mismo patrón que
`marcar.schemas.ts`/`sucursales.schemas.ts`:

```ts
// Acepta "20-12345678-3" o "20123456783" — se le sacan guiones/espacios
// antes de chequear longitud y dígito verificador. El admin no debería
// tener que escribir el CUIL sin separadores para que el sistema lo acepte.
const cuilSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[.\-\s]/g, ""))
  .refine((v) => /^\d{11}$/.test(v), "El CUIL tiene que tener 11 dígitos")
  .refine(validarCuil, "CUIL inválido (el dígito verificador no coincide)");

export const crearEmpleadoSchema = z.object({
  nombre: z.string().trim().min(1),
  apellido: z.string().trim().min(1).optional(),
  celular: z.string().trim().min(1).optional(),
  cuil: cuilSchema.optional(),
  fecha_ingreso: z.string().date().optional(),
  sucursal_id: z.string().trim().min(1).optional(),
  estado: z.enum(["activo", "de_licencia", "suspendido", "baja"]).optional(),
});

export const editarEmpleadoSchema = crearEmpleadoSchema.partial();
```

`celular` se normaliza en `lib/empleados.ts` (no en el schema — necesita
lógica, no solo forma) y se rechaza con 400 si `normalizarCelular`
devuelve `null`.

Tests: `empleados.schemas.test.ts` (mismo patrón que
`sucursales.schemas.test.ts`), incluyendo casos de CUIL con dígito
verificador incorrecto.

**`src/routes/empleados.ts`** (existente) — aplica `validateBody` con
los schemas nuevos en `POST /empleados` y `PATCH /empleados/:id`. Sin
endpoints nuevos.

### 3.3 Frontend (`proyecto-oliver/`)

- **`src/lib/api.ts`** — `Empleado`, `CrearEmpleadoInput`,
  `EditarEmpleadoInput` ganan los campos nuevos y pierden `activo`.
- **`src/pages/empleados/EmpleadosPage.tsx`**:
  - Formulario de alta/edición: `Field` apellido, `Field` CUIL (con
    feedback de dígito verificador inválido inline, igual que hoy
    valida otros campos), `Field` fecha de ingreso, `Select` sucursal
    (opcional), `Select` estado (activo/de licencia/suspendido/baja)
    en vez del switch activo/inactivo actual.
  - Tabla: columna sucursal, columna estado como `Badge`/`Status` (un
    color por estado) en vez de la columna activo/inactivo actual.
  - **Sin filtros por sucursal/estado ni columnas configurables en
    este paso** — eso es Paso 4 del documento ("los lujos"); acá el
    objetivo es que el dato exista y se pueda cargar/ver, no la UX
    completa de listado.
- **Sin ruta ni nav nuevos** — sigue siendo `/empleados`.

## 4. Alcance

### Dentro de alcance

- Migraciones `0011_empleados_identidad.sql` y
  `0012_empleados_drop_activo.sql`.
- Script `scripts/split-apellido.js`.
- `src/lib/cuil.ts`, `src/lib/celular.ts` (+ tests) en
  `proyecto-oliver-api`.
- Cambios en `src/lib/empleados.ts`, `src/routes/empleados.ts`,
  `src/routes/empleados.schemas.ts` (+ tests) en `proyecto-oliver-api`.
- Formulario y tabla de `EmpleadosPage.tsx` en `proyecto-oliver` con
  los campos nuevos.

### Fuera de alcance (Paso 2/3/4 — spec propia cuando corresponda)

- `periodos_laborales` y `empleado_condiciones` con vigencia (Paso 2).
- Documentos con vencimiento, familiares, datos bancarios (Paso 3).
- `dni`, `fecha_nacimiento`, `genero`, `nacionalidad`, `foto_url`,
  `legajo_numero`.
- Alertas automáticas (CUIL faltante, sin sucursal asignada, etc.) —
  necesitan el Centro de IA del roadmap principal (F2), no este paso.
- Filtros, columnas configurables, acciones en lote, importación desde
  Excel, alta en dos pasos, campos personalizados (Paso 4).
- Ficha del empleado con pestañas (sección 6 del documento).

### QA

Sigue la convención sumada en la limpieza de tests reciente: `npm test`
(vitest) en `proyecto-oliver-api` para toda la lógica pura nueva
(`cuil.ts`, `celular.ts`, `empleados.schemas.ts`) más verificación manual
en navegador del alta/edición de empleados con los campos nuevos.

### Criterio de "listo"

- Se puede cargar/editar un empleado con apellido, CUIL (validado),
  fecha de ingreso, sucursal y estado desde `/empleados`.
- Un CUIL con dígito verificador incorrecto se rechaza con un mensaje
  claro, antes de llegar a la base.
- Dos empleados no pueden tener el mismo CUIL en la misma organización,
  ni siquiera si uno está dado de baja.
- El flujo de marcado (`/marcar`) sigue funcionando igual que hoy para
  empleados `activo` y `de_licencia`; `suspendido` y `baja` no pueden
  marcar.
- `npm test` pasa en `proyecto-oliver-api` con los tests nuevos.

## 5. Explícitamente fuera de alcance de este documento

- Paso 2 (`periodos_laborales`, `empleado_condiciones` con vigencia) —
  spec propia, siguiente en la cola según el documento fuente.
- Paso 3 y 4 del documento — sin fecha definida.
- Centro de IA y sus alertas (roadmap principal, F2) — el diseño de
  este paso deja los datos listos para alimentarlo, pero no lo
  implementa.
