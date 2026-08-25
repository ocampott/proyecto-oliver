# Paginado de listados

Fecha: 2026-08-25
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

Varias tablas de la app traen el dataset completo del organismo/org en cada
carga y filtran/buscan en el browser (`EmpleadosPage`, `SucursalesPage`,
parte de `AsistenciaPage`). A medida que las organizaciones crecen, eso
implica endpoints cada vez más pesados y tablas cada vez más largas.

Durante el scoping se encontró un bug relacionado ya presente en
producción: `lib/asistencia.ts` (`proyecto-oliver-api`) tiene
`.limit(500)` en `listAsistencia` y `.limit(200)` en `listRechazadas`,
sin `offset` ni forma de pedir la página siguiente — una organización que
supere esos números en el rango de fechas consultado pierde filas
**silenciosamente**, tanto en la vista como en la exportación a Excel
(`GET /asistencia/export` llama a las mismas funciones). Este trabajo
también corrige eso.

## 2. Decisiones tomadas con el usuario

- **Paginado server-side**, no solo en el cliente — el objetivo explícito
  es aliviar el peso del endpoint y no solo el de la tabla, así que el
  backend tiene que traer una sola página por request.
- **Selector de tamaño de página: 10 / 20 / 30**, default 20. Barra de
  paginado (selector + números de página + Anterior/Siguiente) debajo de
  cada tabla, igual en todas las páginas.
- **Alcance de esta pasada**: Empleados, Asistencia (+ rechazadas), RRHH
  (Ausencias), Sucursales, y en el panel de Admin: Organizaciones,
  Miembros por org, Empleados por org, Sucursales por org.
- **Turnos/Horas quedan fuera de esta pasada.** `calcularHoras` (usado por
  `/horas`) trae los registros crudos de `asistencia` de un rango y los
  empareja en memoria (`emparejarTurnos`) para armar turnos entrada/salida
  — paginar los registros crudos rompería turnos que caen a caballo entre
  dos páginas. Paginar ahí requiere paginar los *turnos ya calculados*,
  no las marcaciones, y es un diseño distinto que no estaba en el pedido
  original. Se deja como trabajo futuro.
- **El filtro "Dispositivo" de Empleados se simplifica a dos opciones para
  el filtrado server-side: Vinculado / No vinculado.** Hoy distingue tres
  estados (Vinculado / OTP pendiente / Sin vincular), pero "OTP pendiente"
  depende de una fila vigente en `otp_codes` (`used_at is null and
  expires_at > now()`) — no es una columna de `empleados`, es un estado
  calculado contra otra tabla con una condición de tiempo. Resolverlo
  100% en SQL es viable (join con filtro por tiempo sobre el recurso
  embebido en PostgREST) pero le suma complejidad y tests a un filtro
  secundario. La **columna de la tabla sigue mostrando el detalle
  completo** (vinculado / OTP pendiente con el código / sin vincular) fila
  por fila — solo el *filtro* pierde esa granularidad.
- Las páginas de Admin (Miembros, Empleados y Sucursales por
  organización) se paginan por consistencia, aunque hoy sean datasets
  chicos por org — el valor real está en la lista de Organizaciones
  (crece con la cantidad de clientes) y en mantener un solo patrón en
  toda la app en vez de dos.

## 3. Arquitectura

### 3.1 Backend (`proyecto-oliver-api/`)

**`src/lib/pagination.ts`** (nuevo, puro, sin import de DB — mismo patrón
que `horas-calculo.ts`/`otp-logica.ts`/`cumplimiento-calculo.ts`):

```ts
export const PAGE_SIZES = [10, 20, 30] as const;
export type PageSize = (typeof PAGE_SIZES)[number];
const DEFAULT_PAGE_SIZE: PageSize = 20;

export interface PaginationParams {
  page: number;
  pageSize: PageSize;
}

export interface PaginationMeta extends PaginationParams {
  total: number;
  totalPages: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: PaginationMeta;
}

/** Clampea valores inválidos a defaults seguros en vez de rechazar con 400 — son query params de UI, no datos de negocio. */
export function parsePagination(query: Record<string, unknown>): PaginationParams {
  const rawPage = Number(query.page);
  const page = Number.isInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const rawPageSize = Number(query.pageSize);
  const pageSize = (PAGE_SIZES as readonly number[]).includes(rawPageSize)
    ? (rawPageSize as PageSize)
    : DEFAULT_PAGE_SIZE;
  return { page, pageSize };
}

export function rangeFor({ page, pageSize }: PaginationParams): { from: number; to: number } {
  const from = (page - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function buildMeta(params: PaginationParams, total: number): PaginationMeta {
  return { ...params, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
}
```

Test `pagination.test.ts`: clamping de `page`/`pageSize` inválidos
(negativos, no numéricos, pageSize fuera de [10,20,30]), `rangeFor` para
página 1/2/N, `buildMeta` con `total=0` (1 página, no 0) y con `total`
exacto múltiplo de `pageSize`.

**Contrato de cada endpoint paginado** — query params `page`, `pageSize`
+ los filtros propios del dominio (ver abajo). Respuesta:
`{ data: T[], pagination: PaginationMeta }`, reemplaza el array plano
actual. Es un cambio de contrato — como front y back se despliegan
juntos, se actualiza todo en el mismo cambio, sin capa de compatibilidad.

**Por dominio:**

| Dominio | Función (`lib/*.ts`) | Filtros nuevos como query param | Nota |
|---|---|---|---|
| Empleados | `listEmpleados(orgId, params)` | `q` (nombre+apellido, `ilike`), `estado`, `sucursalId`, `cuil` (`con`\|`sin`), `dispositivo` (`vinculado`\|`no_vinculado`, ver §2) | `tieneAsistencia` por inactivo ahora corre solo sobre la página actual — mejora el N+1 existente de paso |
| Sucursales | `listSucursales(orgId, params)` | `q` (nombre, `ilike`), `estado` (`activos`\|`inactivos`, mismos valores que ya usa el `EstadoFiltro` del frontend) | mismo N+1 de `tieneAsistencia` acotado a la página |
| Asistencia | `listAsistencia(orgId, filters, params?)` | ya tenía `desde`/`hasta`/`sucursalId`/`empleadoId`; se agrega `tipo` (`entrada`\|`salida`) | `params` opcional: si no viene, sin `.range()` — lo sigue usando `GET /asistencia/export` para traer todo el rango filtrado, sin el `.limit(500)` actual |
| Asistencia rechazadas | `listRechazadas(orgId, params?)` | — | mismo patrón: `params` opcional para el export, sin el `.limit(200)` actual |
| RRHH/Ausencias | `listAusencias(orgId, filters, params?)` | ya tenía `desde`/`hasta`/`sucursalId`/`motivo`/`empleadoId` | `params` opcional, mismo motivo: `GET /rrhh/ausencias/export` sigue trayendo todo |
| Admin/Organizaciones | nueva `listOrganizations(params)` en `lib/organizations.ts` (hoy la query vive inline en `routes/admin.ts`) | `q` (nombre/slug) | primera vez que esta lista tiene filtro de búsqueda |
| Admin/Miembros por org | `listMiembros(orgId, params)` | — | el `.range()` va antes del `Promise.all` que resuelve emails por Auth Admin API — reduce ese N+1 a la página, no solo lo pagina |
| Admin/Empleados por org | reusa `listEmpleados` | igual que Empleados | — |
| Admin/Sucursales por org | reusa `listSucursales` | igual que Sucursales | — |

Los exports (`asistencia/export`, `rrhh/ausencias/export`) **dejan de
truncar**: llaman a `listAsistencia`/`listRechazadas`/`listAusencias` sin
`params` (todo el dataset filtrado, sin límite oculto) — arregla el bug
de la sección 1 también para el Excel, no solo para la tabla en pantalla.

**Validación de query params**: no se usa `validateBody`/zod para
`page`/`pageSize` (son UI, se clampean, no se rechazan — criterio ya
definido en `parsePagination`). Los filtros de texto libre (`q`) sí se
recortan/normalizan igual que hoy se hace con otros inputs, pero sin
schema formal — son criterios de búsqueda, no datos que se persisten.

### 3.2 Frontend (`proyecto-oliver/`)

**`src/lib/api.ts`**:

- Tipo genérico `Paginated<T>` espejo del backend.
- Cada función de listado (`listEmpleados`, `listSucursales`,
  `listAsistencia`, `listRechazadas`, `getAusencias`,
  `listOrganizationsAdmin`, `listMiembrosAdmin`, `listEmpleadosAdmin`,
  `listSucursalesAdmin`) pasa a aceptar `{ page, pageSize, ...filtros }`
  y devuelve `Paginated<T>` en vez de `T[]`.
- `request()` no cambia — cada función arma su propio query string, como
  ya hace hoy (mismo patrón, más params).

**`src/components/ui/pagination.tsx`** (nuevo):

- Recibe `{ pagination: PaginationMeta, onPageChange, onPageSizeChange }`.
- Selector "por página" (10/20/30) + números de página (con elipsis si
  hay muchas) + botones Anterior/Siguiente, deshabilitados en los
  extremos. Mismo lenguaje visual que `FilterChip`/`Button` existentes.
- Vive debajo del `Table` de cada página, mismo lugar en todas.

**Hooks (`hooks.ts` de cada página)**:

- Pasan a recibir `page`/`pageSize`/filtros como argumentos reactivos;
  la `queryKey` los incluye.
- `placeholderData: keepPreviousData` (TanStack Query v5) para que
  cambiar de página no parpadee en blanco mientras llega la respuesta.

**Páginas**: cada una suma `const [page, setPage] = useState(1)` y
`const [pageSize, setPageSize] = useState(20)`. Los filtros que hoy
filtran el array en memoria (`FilterChip`s de Empleados y Sucursales, y
Empleado/Sucursal/Tipo de Asistencia) pasan a viajar como parámetro de la
query en vez de correr en `Array.prototype.filter` — el componente
`FilterChip` no cambia, solo lo que hace su `onChange`. **Cualquier
cambio de filtro, de búsqueda, o de `pageSize` resetea `page` a 1** (un
`useEffect` con esas dependencias, o resetear inline en cada setter).

RRHH ya filtra server-side (`useAusencias(filters)`), así que solo suma
`page`/`pageSize` a los params existentes, sin migrar filtros.

El `FilterChip` de "Dispositivo" en Empleados pierde una opción: pasa de
`todos/vinculado/otp_pendiente/sin_vincular` a `todos/vinculado/no_vinculado`,
reflejando el filtro simplificado del §2. La columna de la tabla no
cambia — sigue mostrando el detalle completo (badge "Vinculado", código
OTP pendiente, o "Sin vincular") fila por fila, eso viene del row data,
no del filtro.

## 4. Alcance

### Dentro de alcance

- `proyecto-oliver-api`: `src/lib/pagination.ts` + test; cambios en
  `lib/empleados.ts`, `lib/sucursales.ts`, `lib/asistencia.ts`,
  `lib/rrhh.ts`, `lib/organizations.ts`, `lib/miembros.ts`; rutas
  `routes/empleados.ts`, `routes/sucursales.ts`, `routes/asistencia.ts`,
  `routes/rrhh.ts`, `routes/admin.ts` (parseo de `page`/`pageSize`/
  filtros nuevos, respuesta `{ data, pagination }`).
- `proyecto-oliver`: `src/lib/api.ts` (tipos `Paginated<T>` + firmas
  nuevas), `src/components/ui/pagination.tsx`, hooks y páginas de
  Empleados, Asistencia, RRHH, Sucursales, y las vistas de Admin
  (`AdminPage.tsx`, `OrganizacionDetallePage.tsx`).
- Fix del truncado silencioso en `listAsistencia`/`listRechazadas` para
  los endpoints de export.

### Fuera de alcance

- Turnos/Horas (`/horas`, `/turnos`) — requiere paginar turnos
  calculados, no registros crudos; diseño propio a futuro.
- Filtro "Dispositivo" de Empleados con las 3 opciones originales
  filtradas server-side (join por tiempo contra `otp_codes`) — queda en
  2 opciones (Vinculado/No vinculado) para el filtro; la columna de la
  tabla no pierde detalle.
- Cursor-based pagination — offset/limit alcanza para el volumen actual
  y es más simple de exponer como "página N de M" en la UI.
- Ordenamiento configurable por columna (sigue siendo el `order()` fijo
  que ya tiene cada query).

### QA

- `npm test` (vitest) en `proyecto-oliver-api` para `pagination.test.ts`
  y cualquier ajuste a schemas/tests existentes que toque `page`/`pageSize`.
- Verificación manual en navegador: cambiar de página y de tamaño de
  página en cada una de las tablas en alcance, combinado con al menos un
  filtro activo, confirmando que `total`/`totalPages` coincide con lo
  esperado y que la página vuelve a 1 al cambiar un filtro.
- Confirmar que `GET /asistencia/export` y `GET /rrhh/ausencias/export`
  siguen trayendo el dataset completo filtrado (sin el límite viejo).

### Criterio de "listo"

- Las tablas en alcance muestran 10/20/30 filas según lo elegido, con
  navegación de página y sin traer más datos de los necesarios por
  request (confirmable mirando el payload de red).
- Los filtros existentes (búsqueda, estado, sucursal, CUIL, dispositivo,
  tipo) siguen funcionando, ahora combinados correctamente con paginado
  (el conteo total refleja el filtro aplicado, no el dataset completo).
- Una organización con más de 500 marcaciones de asistencia (o 200
  rechazadas) en el rango de fechas consultado ya no pierde filas ni en
  pantalla ni en el Excel exportado.
- `npm test` pasa en `proyecto-oliver-api`.

## 5. Explícitamente fuera de alcance de este documento

- Paginado de Turnos/Horas (turnos calculados) — spec propia si se
  prioriza a futuro.
- Filtro de Dispositivo con las 3 opciones vía join a `otp_codes` —
  puede revisarse más adelante si se vuelve necesario.
- Cualquier cambio de ordenamiento/columnas configurables — no forma
  parte de este pedido.
