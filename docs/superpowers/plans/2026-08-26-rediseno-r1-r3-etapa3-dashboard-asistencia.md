# Rediseño R1/R3 — Etapa 3: Dashboard + Asistencia Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rehacer el Dashboard (Pulso operativo) y la página de Asistencia con la estructura de R3 (tabs, toolbar de filtros, panel lateral de detalle, agrupación por fecha) sobre la lógica de negocio ya existente, sin tocar backend.

**Architecture:** Primera etapa que toca páginas reales (las Etapas 1-2 fueron sistema base y layout, cero páginas). Cuatro tasks: (1) `PageHeader.tsx` — retint compacto + props nuevas opcionales (`actions`, `breadcrumb`) sin romper a los 9 consumidores que todavía no se tocan; (2) Dashboard (`HomePage.tsx` + `PulsoOperativo.tsx` + un ajuste de 1 línea en `useAsistenciaEnVivo.ts`) — agrega `StatRow`, desglose "Ahora mismo" por sucursal, y una sección nueva "Pendientes de revisión" reusando los hooks de rechazadas que ya existen; (3) Asistencia — reemplaza `FilterChip` por `Toolbar`+`Select` y convierte la sección de rechazados en un tab real con `Tabs`; (4) Asistencia — agrega `SidePanel` de detalle al hacer click en una fila y agrupación visual por fecha en la tabla. Se crea un archivo nuevo compartido (`src/pages/asistencia/format.ts`) para no duplicar `horaLocal`/`MOTIVOS_RECHAZO` entre Dashboard y Asistencia.

**Tech Stack:** Sin dependencias nuevas — componentes de la Etapa 1 (`Toolbar`, `Tabs`, `SidePanel`, `StatRow`) ya mergeados en la rama base de esta etapa (`rediseno-r1-r3-etapa2`), más lo ya instalado (`lucide-react`, `@tanstack/react-query`, `react-router-dom`).

**Spec:** `docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md`

## Global Constraints

- **Sin cambios de backend** — cero endpoints nuevos, cero columnas nuevas. Todo sale de hooks/mutations que ya existen.
- **`AsistenciaRegistro` (marcas aprobadas) no tiene `distancia_metros`** — solo `Rechazada` lo tiene. El bloque de "validación de geocerca" del `SidePanel` de detalle se limita a mostrar lat/lon tal cual vienen (`ponytail: sin cálculo de distancia para marcas aprobadas — el dato no existe en este registro; si se necesita, requiere sumar radio de la sucursal + fórmula de distancia, evaluar en una etapa posterior`) — no se inventa un cálculo de distancia nuevo.
- **`PageHeaderProps.kicker` se vuelve opcional, no se elimina** — 9 páginas fuera de esta etapa (Turnos, Horas, Empleados, Sucursales, RRHH, Configuración, Plan, Admin, OrganizacionDetalle) todavía le pasan `kicker="..."` y no se tocan hasta etapas futuras; si `kicker` dejara de aceptarse esas páginas no compilarían.
- **Búsqueda de empleado en el filtro de Asistencia sigue siendo un `Select`, no un buscador de texto libre** — el backend (`ListAsistenciaParams`) solo acepta `empleadoId` exacto, no un parámetro de búsqueda por nombre; agregar eso sería tocar backend, fuera de alcance. Es la misma limitación que ya existía con `FilterChip`, solo cambia el widget.
- **Sin sincronizar la tab de Asistencia (Registros/Rechazadas) a un query param de la URL** — R3 lo hace, pero esta app no usa query params de navegación en ningún otro lado; un `useState` simple alcanza y no introduce un patrón nuevo solo para esta página.
- **Se preserva toda la lógica de negocio existente sin cambios**: gating por plan/rol, exportar a Excel, aprobar/descartar rechazadas, borrar registro con confirmación, timezone `America/Argentina/Buenos_Aires`, realtime de Supabase en el dashboard.
- **Sin tests automatizados de UI** — verificación es `npm run build`, con `rm -f node_modules/.tmp/*.tsbuildinfo` antes de cada build para evitar el cache mentiroso de `tsc -b`.

---

## Task 1: `PageHeader.tsx` — retint compacto + `actions`/`breadcrumb` opcionales

**Files:**
- Modify: `src/components/PageHeader.tsx`

**Interfaces:**
- `PageHeaderProps`: `kicker` pasa de obligatorio a **opcional** (`kicker?: string`) — los 9 call-sites existentes que lo pasan siguen compilando igual. Se agregan dos props opcionales nuevas: `actions?: ReactNode` (botones a la derecha, junto a `meta`) y `breadcrumb?: { label: string; href?: string }[]` (sin consumidor en esta etapa — lo usarán futuras páginas de detalle, Empleados/Sucursales, etapas 5-6). `title`, `description`, `meta` no cambian.

- [ ] **Step 1: Reemplazar `PageHeader.tsx` completo**

```tsx
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../lib/utils";

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  kicker?: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: PageHeaderBreadcrumb[];
}

/** Encabezado compartido por todas las pantallas internas. */
export function PageHeader({ kicker, title, description, meta, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1.5 text-[12.5px] text-text-tertiary">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                {b.href ? (
                  <Link to={b.href} className="hover:text-text-secondary">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-text-secondary">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        {kicker && <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{kicker}</p>}
        <h1 className={cn("text-[26px] font-semibold tracking-[-0.02em] text-text md:text-[28px]", kicker && "mt-1")}>
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm text-text-secondary">{description}</p>}
      </div>
      {(meta || actions) && (
        <div className="flex shrink-0 items-center gap-3">
          {meta && <p className="font-mono text-xs text-text-tertiary">{meta}</p>}
          {actions}
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

Esperado: sin errores. Los 9 call-sites que solo pasan `kicker`/`title`/`meta` siguen compilando sin cambios (ninguno se toca en este task).

- [ ] **Step 3: Commit**

```bash
git add src/components/PageHeader.tsx
git commit -m "feat: PageHeader compacto con acciones/breadcrumb opcionales, kicker retrocompatible"
```

---

## Task 2: Dashboard — `HomePage.tsx` + `PulsoOperativo.tsx` + `useAsistenciaEnVivo.ts`

**Files:**
- Create: `src/pages/asistencia/format.ts`
- Modify: `src/components/dashboard/PulsoOperativo.tsx`
- Modify: `src/components/dashboard/useAsistenciaEnVivo.ts`
- Modify: `src/pages/HomePage.tsx`

**Interfaces:**
- Consumes: `StatRow`/`StatRowItem` (`src/components/ui/stat-row.tsx`, Etapa 1); `useRechazadas`, `useResolverRechazada` (`src/pages/asistencia/hooks.ts`, ya existentes); `useToast` (`src/components/ui/toast.tsx`).
- Produces: `src/pages/asistencia/format.ts` exporta `horaLocal(iso: string): string`, `fechaLocal(iso: string): string`, `MOTIVOS_RECHAZO: Record<MotivoRechazo, string>` — consumido acá y también por el Task 3/4 de este mismo plan (que van a **quitar** las copias locales equivalentes de `AsistenciaPage.tsx` e importar de acá en su lugar).
- `useAsistenciaEnVivo`'s `ultimosMarcados` pasa de máximo 3 a máximo 6 registros (un `.slice(0, 3)` → `.slice(0, 6)` en `derivarUltimosMarcados`).

- [ ] **Step 1: Crear `src/pages/asistencia/format.ts`**

```ts
import type { MotivoRechazo } from "../../lib/api";

const AR_TZ = "America/Argentina/Buenos_Aires";

export function horaLocal(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

export function fechaLocal(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: AR_TZ,
  });
}

export const MOTIVOS_RECHAZO: Record<MotivoRechazo, string> = {
  fuera_de_rango: "Fuera de rango",
  sucursal_sin_gps: "Sucursal sin GPS configurado",
  nombre_no_encontrado: "Nombre no encontrado en la nómina",
  dispositivo_ya_vinculado: "Ya vinculado a otro dispositivo",
};
```

- [ ] **Step 2: Bumpear `useAsistenciaEnVivo.ts` de 3 a 6 últimos marcados**

Buscar esta línea dentro de `derivarUltimosMarcados`:

```ts
    .slice(0, 3)
```

Reemplazar por:

```ts
    .slice(0, 6)
```

(Es la única aparición de `.slice(0, 3)` en el archivo.)

- [ ] **Step 3: Reemplazar `PulsoOperativo.tsx` completo**

```tsx
import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "../ui/card";
import { Status } from "../ui/status";
import { Button } from "../ui/button";
import { StatRow, type StatRowItem } from "../ui/stat-row";
import { useToast } from "../ui/toast";
import { useAsistenciaEnVivo } from "./useAsistenciaEnVivo";
import { useOlvidaronSalida } from "./useOlvidaronSalida";
import { useAusenciasHoy } from "./useAusenciasHoy";
import { useRechazadas, useResolverRechazada } from "../../pages/asistencia/hooks";
import { horaLocal, fechaLocal, MOTIVOS_RECHAZO } from "../../pages/asistencia/format";
import { useEntitlements, tieneModulo } from "../../lib/hooks";
import type { Ausencia } from "../../lib/api";

type EnVivo = ReturnType<typeof useAsistenciaEnVivo>;

function diasAusencia(a: Pick<Ausencia, "fecha_desde" | "fecha_hasta">): number {
  const desde = new Date(a.fecha_desde).getTime();
  const hasta = new Date(a.fecha_hasta).getTime();
  return Math.round((hasta - desde) / 86400000) + 1;
}

function AhoraMismo({ enVivo }: { enVivo: EnVivo }) {
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ahora mismo</h3>
        <Status tone={enVivo.conectado ? "success" : "neutral"}>
          {enVivo.conectado ? "En vivo" : "Actualizando"}
        </Status>
      </div>
      {enVivo.isError && <p className="mt-4 text-sm text-alert">No pudimos cargar asistencia.</p>}
      {!enVivo.isError && enVivo.isLoading && <p className="mt-4 text-sm text-text-tertiary">Cargando...</p>}
      {!enVivo.isError && !enVivo.isLoading && (
        <div className="mt-4 flex flex-col gap-4">
          {enVivo.porSucursal.length === 0 && (
            <p className="text-sm text-text-tertiary">Nadie marcó entrada todavía.</p>
          )}
          {enVivo.porSucursal.map((g) => (
            <div key={g.sucursalId}>
              <p className="flex items-center justify-between text-[13px] font-semibold text-text">
                {g.sucursalNombre}
                <span className="data-number font-mono text-text-tertiary">{g.empleados.length}</span>
              </p>
              <ul className="mt-1.5 flex flex-col gap-1">
                {g.empleados.map((e) => (
                  <li key={e.empleadoId} className="flex items-baseline justify-between text-[13px] text-text-secondary">
                    <span className="truncate">{e.empleadoNombre}</span>
                    <span className="shrink-0 font-mono text-xs text-text-tertiary">desde {horaLocal(e.desde)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function UltimosMovimientos({ enVivo }: { enVivo: EnVivo }) {
  return (
    <Card>
      <h3 className="text-sm font-semibold">Últimos movimientos</h3>
      {enVivo.isLoading && <p className="mt-5 text-sm text-text-tertiary">Cargando actividad...</p>}
      {enVivo.isError && <p className="mt-5 text-sm text-alert">No pudimos cargar asistencia.</p>}
      {!enVivo.isLoading && !enVivo.isError && (
        <ul className="mt-4 flex flex-col gap-3">
          {enVivo.ultimosMarcados.map((m) => (
            <li key={m.id} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{m.empleadoNombre}</span>
              <span className="shrink-0 font-mono text-xs text-text-tertiary">
                {m.tipo === "entrada" ? "Entró" : "Salió"} {horaLocal(m.hora)}
              </span>
            </li>
          ))}
          {enVivo.ultimosMarcados.length === 0 && <li className="text-sm text-text-tertiary">Sin marcas hoy todavía.</li>}
        </ul>
      )}
    </Card>
  );
}

function PendientesRevision() {
  const { data, isLoading } = useRechazadas({ page: 1, pageSize: 5 });
  const resolver = useResolverRechazada();
  const toast = useToast();
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const rechazadas = data?.data ?? [];
  const total = data?.pagination.total ?? 0;

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    setResolviendoId(id);
    try {
      await resolver.mutateAsync({ id, accion });
      toast.success(accion === "aprobar" ? "Intento aprobado." : "Intento descartado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo resolver el intento.");
    } finally {
      setResolviendoId(null);
    }
  }

  if (!isLoading && total === 0) return null;

  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Pendientes de revisión</h3>
        {total > 0 && <Status tone="warning">{total}</Status>}
      </div>
      {isLoading && <p className="mt-4 text-sm text-text-tertiary">Revisando marcas...</p>}
      {!isLoading && (
        <ul className="mt-4 flex flex-col gap-3">
          {rechazadas.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.empleado_nombre ?? "—"}</span>
                <span className="block truncate text-xs text-text-tertiary">
                  {r.sucursal_nombre ?? "—"} · {MOTIVOS_RECHAZO[r.motivo] ?? r.motivo}
                </span>
              </span>
              <span className="flex shrink-0 gap-1.5">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleResolver(r.id, "aprobar")}
                  disabled={resolviendoId === r.id}
                >
                  Aprobar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleResolver(r.id, "descartar")}
                  disabled={resolviendoId === r.id}
                >
                  Descartar
                </Button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {total > rechazadas.length && (
        <Link to="/asistencia" className="mt-3 inline-block text-xs font-medium text-accent-700 hover:underline">
          Ver todas ({total})
        </Link>
      )}
    </Card>
  );
}

function AusenciasHoy() {
  const query = useAusenciasHoy();
  return (
    <Card>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Ausencias de hoy</h3>
        <Link to="/rrhh" className="text-xs font-medium text-accent-700 hover:underline">
          Ver todas
        </Link>
      </div>
      {query.isLoading && <p className="mt-4 text-sm text-text-tertiary">Revisando RRHH...</p>}
      {query.isError && <p className="mt-4 text-sm text-alert">No pudimos cargar RRHH.</p>}
      {!query.isLoading && !query.isError && (
        <ul className="mt-4 flex flex-col gap-3">
          {query.ausencias.map((a) => (
            <li key={a.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.empleado_nombre}</span>
                <span className="block truncate text-xs text-text-tertiary">{a.sucursal_nombre ?? "—"}</span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                {a.certificado_pendiente ? (
                  <Status tone="warning">Certificado pendiente</Status>
                ) : (
                  <span className="text-xs text-text-tertiary">{a.motivo}</span>
                )}
                <span className="font-mono text-xs text-text-tertiary">{diasAusencia(a)}d</span>
              </span>
            </li>
          ))}
          {query.ausencias.length === 0 && <li className="text-sm text-text-tertiary">Sin ausencias hoy.</li>}
        </ul>
      )}
    </Card>
  );
}

function PendingHours() {
  const query = useOlvidaronSalida();
  return (
    <Card>
      <h3 className="text-sm font-semibold">Olvidaron salida</h3>
      {query.isLoading && <p className="mt-5 text-sm text-text-tertiary">Revisando turnos...</p>}
      {query.isError && <p className="mt-5 text-sm text-alert">No pudimos cargar horas.</p>}
      {!query.isLoading && !query.isError && (
        <ul className="mt-4 flex flex-col gap-3">
          {query.turnos.slice(0, 4).map((t) => (
            <li key={`${t.empleadoId}-${t.entradaAt}`} className="flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate font-medium">{t.nombre}</span>
              <span className="shrink-0 font-mono text-xs text-alert">
                {fechaLocal(t.entradaAt)} {horaLocal(t.entradaAt)}
              </span>
            </li>
          ))}
          {query.turnos.length === 0 && <li className="text-sm text-text-tertiary">Todo en orden.</li>}
        </ul>
      )}
    </Card>
  );
}

export function PulsoOperativo({ orgId }: { orgId: string }) {
  const ent = useEntitlements();
  const live = useAsistenciaEnVivo(orgId);
  const ausenciasQuery = useAusenciasHoy();
  const olvidaronQuery = useOlvidaronSalida();
  const { data: rechazadasData, isLoading: rechazadasLoading } = useRechazadas({ page: 1, pageSize: 5 });

  const totalAdentro = live.porSucursal.reduce((acc, g) => acc + g.empleados.length, 0);
  const rechazadasCount = rechazadasData?.pagination.total ?? 0;

  const stats: StatRowItem[] = [{ label: "Adentro ahora", value: live.isLoading ? "—" : totalAdentro }];
  if (tieneModulo(ent, "rrhh")) {
    stats.push({
      label: "Ausencias hoy",
      value: ausenciasQuery.isLoading ? "—" : ausenciasQuery.ausencias.length,
      tone: ausenciasQuery.ausencias.length > 0 ? "warning" : "default",
    });
  }
  stats.push({
    label: "Marcas rechazadas",
    value: rechazadasLoading ? "—" : rechazadasCount,
    tone: rechazadasCount > 0 ? "warning" : "default",
  });
  if (tieneModulo(ent, "horas")) {
    stats.push({
      label: "Olvidaron salida",
      value: olvidaronQuery.isLoading ? "—" : olvidaronQuery.turnos.length,
      tone: olvidaronQuery.turnos.length > 0 ? "alert" : "default",
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <StatRow stats={stats} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <AhoraMismo enVivo={live} />
        {tieneModulo(ent, "rrhh") && <AusenciasHoy />}
        <PendientesRevision />
        {tieneModulo(ent, "horas") && <PendingHours />}
        <UltimosMovimientos enVivo={live} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Quitar el `kicker` de `HomePage.tsx`**

Buscar (dentro del `return` de `HomePage`):

```tsx
      <PageHeader
        kicker="Panel de control"
        title={org.name}
        meta={new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
      />
```

Reemplazar por:

```tsx
      <PageHeader
        title={org.name}
        meta={new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}
      />
```

- [ ] **Step 5: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/pages/asistencia/format.ts src/components/dashboard/PulsoOperativo.tsx src/components/dashboard/useAsistenciaEnVivo.ts src/pages/HomePage.tsx
git commit -m "feat: dashboard con StatRow, Ahora mismo por sucursal y Pendientes de revisión"
```

---

## Task 3: Asistencia — Toolbar + Tabs (Registros/Rechazadas)

**Files:**
- Modify: `src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:**
- Consumes: `Toolbar` (`src/components/ui/toolbar.tsx`), `Select` (`src/components/ui/select.tsx`), `Tabs` (`src/components/ui/tabs.tsx`), `horaLocal`/`MOTIVOS_RECHAZO` (`src/pages/asistencia/format.ts`, Task 2 de este mismo plan). Deja de usar `FilterChip` y `Badge` en este archivo (los reemplaza `Toolbar`/`Select` y el badge de contador integrado en `Tabs`).
- No cambia ninguna función/hook de `./hooks` — misma lógica de negocio, solo cambia el shell visual y la agrupación en tabs.

- [ ] **Step 1: Reemplazar `AsistenciaPage.tsx` completo**

```tsx
import { useState } from "react";
import { LogIn, LogOut, Download, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { Tabs } from "../../components/ui/tabs";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { AsistenciaRegistro, TipoMarca } from "../../lib/api";
import { useAsistenciaPaginada, useRechazadas, useBorrarAsistencia, useResolverRechazada } from "./hooks";
import { horaLocal, MOTIVOS_RECHAZO } from "./format";
import { Pagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/PageHeader";
import { exportarAsistencia } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { useEntitlements, useOrgActual, tieneModulo, puedeGestionar } from "../../lib/hooks";

type TipoFiltro = "todos" | TipoMarca;
type Vista = "registros" | "rechazadas";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
}

export default function AsistenciaPage() {
  const [vista, setVista] = useState<Vista>("registros");
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [empleadoFiltro, setEmpleadoFiltro] = useState("todos");
  const [sucursalFiltro, setSucursalFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [rechazadasPage, setRechazadasPage] = useState(1);
  const [rechazadasPageSize, setRechazadasPageSize] = useState(20);

  const { data, isLoading, isError } = useAsistenciaPaginada(desde, hasta, {
    page,
    pageSize,
    empleadoId: empleadoFiltro === "todos" ? undefined : empleadoFiltro,
    sucursalId: sucursalFiltro === "todos" ? undefined : sucursalFiltro,
    tipo: tipoFiltro === "todos" ? undefined : tipoFiltro,
  });
  const registros = data?.data ?? [];
  const { data: rechazadasData } = useRechazadas({ page: rechazadasPage, pageSize: rechazadasPageSize });
  const rechazadas = rechazadasData?.data ?? [];
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const borrar = useBorrarAsistencia();
  const resolver = useResolverRechazada();
  const toast = useToast();
  const ent = useEntitlements();
  const sinReportes = !tieneModulo(ent, "reportes");
  const { data: org } = useOrgActual();
  const gestionable = puedeGestionar(org ?? null);
  const [descargando, setDescargando] = useState(false);
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<AsistenciaRegistro | null>(null);

  const filtrosActivos = empleadoFiltro !== "todos" || sucursalFiltro !== "todos" || tipoFiltro !== "todos";

  function limpiarFiltros() {
    setEmpleadoFiltro("todos");
    setSucursalFiltro("todos");
    setTipoFiltro("todos");
    setPage(1);
  }

  async function handleDescargarExcel() {
    setDescargando(true);
    try {
      await exportarAsistencia(desde, hasta);
      toast.success("Excel descargado.");
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  async function handleBorrar() {
    if (!borrarTarget) return;
    try {
      await borrar.mutateAsync(borrarTarget.id);
      toast.success("Registro borrado.");
      setBorrarTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el registro.");
    }
  }

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    setResolviendoId(id);
    try {
      await resolver.mutateAsync({ id, accion });
      toast.success(accion === "aprobar" ? "Intento aprobado." : "Intento descartado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo resolver el intento.");
    } finally {
      setResolviendoId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Asistencia"
        actions={
          <Button
            variant="secondary"
            onClick={handleDescargarExcel}
            disabled={descargando || sinReportes || !gestionable}
            title={
              !gestionable
                ? "Tu rol no tiene acceso a exportar."
                : sinReportes
                  ? "Exportar es una función del plan Básico. Pasate a un plan superior para usarla."
                  : undefined
            }
          >
            <Download className="h-4 w-4" />
            {descargando ? "Generando…" : "Descargar Excel"}
          </Button>
        }
      />

      <div className="mt-6">
        <Tabs
          value={vista}
          onChange={setVista}
          items={[
            { value: "registros", label: "Registros" },
            { value: "rechazadas", label: "Rechazadas", count: rechazadasData?.pagination.total },
          ]}
        />
      </div>

      {vista === "registros" && (
        <section className="page-section">
          <Toolbar>
            <Field
              label="Desde"
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setPage(1); }}
              containerClassName="w-40"
            />
            <Field
              label="Hasta"
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setPage(1); }}
              containerClassName="w-40"
            />
            <Select
              label="Empleado"
              value={empleadoFiltro}
              onChange={(e) => { setEmpleadoFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
              containerClassName="w-44"
            />
            <Select
              label="Sucursal"
              value={sucursalFiltro}
              onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...sucursales.map((suc) => ({ value: suc.id, label: suc.nombre }))]}
              containerClassName="w-44"
            />
            <Select
              label="Tipo"
              value={tipoFiltro}
              onChange={(e) => { setTipoFiltro(e.target.value as TipoFiltro); setPage(1); }}
              options={[
                { value: "todos", label: "Todos" },
                { value: "entrada", label: "Entrada" },
                { value: "salida", label: "Salida" },
              ]}
              containerClassName="w-36"
            />
            <div className="ml-auto flex items-center gap-3">
              {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
              <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
            </div>
          </Toolbar>

          {isError && <p className="mt-2 text-[15px] text-alert">No se pudieron cargar los registros. Probá de nuevo.</p>}

          <Table containerClassName="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableSkeleton cols={5} />}
              {registros.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{horaLocal(r.created_at)}</TableCell>
                  <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                  <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>
                    {r.tipo === "entrada" ? (
                      <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-success-700">
                        <LogIn className="h-3 w-3" /> Entrada
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-text-secondary">
                        <LogOut className="h-3 w-3" /> Salida
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      {gestionable && (
                        <Button variant="secondary" size="default" onClick={() => setBorrarTarget(r)}>
                          Borrar
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!isLoading && registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-text-tertiary">
                    No hay registros en este rango.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
        </section>
      )}

      {vista === "rechazadas" && (
        <section className="page-section">
          <Table containerClassName="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rechazadas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{horaLocal(r.created_at)}</TableCell>
                  <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                  <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>
                    {MOTIVOS_RECHAZO[r.motivo] ?? r.motivo}
                    {r.motivo === "fuera_de_rango" && r.distancia_metros != null && (
                      <span className="text-text-tertiary"> (a {r.distancia_metros} m)</span>
                    )}
                    {r.tipo && <span className="text-text-tertiary"> — {r.tipo}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="default"
                        onClick={() => handleResolver(r.id, "aprobar")}
                        disabled={resolviendoId === r.id}
                      >
                        {resolviendoId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Aprobar
                      </Button>
                      <Button
                        variant="secondary"
                        size="default"
                        onClick={() => handleResolver(r.id, "descartar")}
                        disabled={resolviendoId === r.id}
                      >
                        Descartar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rechazadas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-text-tertiary">
                    No hay marcas rechazadas pendientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rechazadasData && (
            <Pagination
              pagination={rechazadasData.pagination}
              onPageChange={setRechazadasPage}
              onPageSizeChange={(s) => { setRechazadasPageSize(s); setRechazadasPage(1); }}
            />
          )}
        </section>
      )}

      <Dialog open={borrarTarget != null} onClose={() => setBorrarTarget(null)} title="Borrar registro">
        <p className="text-[15px] text-text-secondary">
          ¿Borrar el registro de {borrarTarget?.tipo === "entrada" ? "entrada" : "salida"} de{" "}
          <strong>{borrarTarget?.empleado_nombre ?? "este empleado"}</strong> del{" "}
          {borrarTarget ? horaLocal(borrarTarget.created_at) : ""}? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBorrarTarget(null)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleBorrar} disabled={borrar.isPending}>
            {borrar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Borrar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/asistencia/AsistenciaPage.tsx
git commit -m "feat: Asistencia con Tabs Registros/Rechazadas y Toolbar de filtros (reemplaza FilterChip)"
```

---

## Task 4: Asistencia — `SidePanel` de detalle + agrupación por fecha

**Files:**
- Modify: `src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:**
- Consumes: `SidePanel` (`src/components/ui/side-panel.tsx`, Etapa 1); `fechaLocal` (`src/pages/asistencia/format.ts`, Task 2 de este mismo plan — no se usaba todavía en este archivo).
- Este task reemplaza el archivo completo otra vez (superando la versión del Task 3) — agrega agrupación visual por fecha en la tabla de Registros y un `SidePanel` que se abre al clickear una fila, con un botón "Borrar registro" en el footer que dispara el mismo diálogo de confirmación que ya existía (no se duplica la lógica de borrado).

- [ ] **Step 1: Reemplazar `AsistenciaPage.tsx` completo**

```tsx
import { useState, useMemo, Fragment } from "react";
import { LogIn, LogOut, Download, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Select } from "../../components/ui/select";
import { Toolbar } from "../../components/ui/toolbar";
import { Tabs } from "../../components/ui/tabs";
import { SidePanel } from "../../components/ui/side-panel";
import { ClearFiltersButton } from "../../components/ui/clear-filters-button";
import { Dialog } from "../../components/ui/dialog";
import { useToast } from "../../components/ui/toast";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import type { AsistenciaRegistro, TipoMarca } from "../../lib/api";
import { useAsistenciaPaginada, useRechazadas, useBorrarAsistencia, useResolverRechazada } from "./hooks";
import { horaLocal, fechaLocal, MOTIVOS_RECHAZO } from "./format";
import { Pagination } from "../../components/ui/pagination";
import { PageHeader } from "../../components/PageHeader";
import { exportarAsistencia } from "../../lib/api";
import { useEmpleados } from "../empleados/hooks";
import { useSucursales } from "../sucursales/hooks";
import { useEntitlements, useOrgActual, tieneModulo, puedeGestionar } from "../../lib/hooks";

type TipoFiltro = "todos" | TipoMarca;
type Vista = "registros" | "rechazadas";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
}

function agruparPorFecha(registros: AsistenciaRegistro[]): { fecha: string; registros: AsistenciaRegistro[] }[] {
  const grupos: { fecha: string; registros: AsistenciaRegistro[] }[] = [];
  for (const r of registros) {
    const fecha = fechaLocal(r.created_at);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.fecha === fecha) {
      ultimo.registros.push(r);
    } else {
      grupos.push({ fecha, registros: [r] });
    }
  }
  return grupos;
}

export default function AsistenciaPage() {
  const [vista, setVista] = useState<Vista>("registros");
  const [desde, setDesde] = useState(hoyAR());
  const [hasta, setHasta] = useState(hoyAR());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [empleadoFiltro, setEmpleadoFiltro] = useState("todos");
  const [sucursalFiltro, setSucursalFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState<TipoFiltro>("todos");
  const [rechazadasPage, setRechazadasPage] = useState(1);
  const [rechazadasPageSize, setRechazadasPageSize] = useState(20);
  const [detalle, setDetalle] = useState<AsistenciaRegistro | null>(null);

  const { data, isLoading, isError } = useAsistenciaPaginada(desde, hasta, {
    page,
    pageSize,
    empleadoId: empleadoFiltro === "todos" ? undefined : empleadoFiltro,
    sucursalId: sucursalFiltro === "todos" ? undefined : sucursalFiltro,
    tipo: tipoFiltro === "todos" ? undefined : tipoFiltro,
  });
  const registros = data?.data ?? [];
  const grupos = useMemo(() => agruparPorFecha(registros), [registros]);
  const { data: rechazadasData } = useRechazadas({ page: rechazadasPage, pageSize: rechazadasPageSize });
  const rechazadas = rechazadasData?.data ?? [];
  const { data: empleados = [] } = useEmpleados();
  const { data: sucursalesData } = useSucursales();
  const sucursales = sucursalesData?.data ?? [];
  const borrar = useBorrarAsistencia();
  const resolver = useResolverRechazada();
  const toast = useToast();
  const ent = useEntitlements();
  const sinReportes = !tieneModulo(ent, "reportes");
  const { data: org } = useOrgActual();
  const gestionable = puedeGestionar(org ?? null);
  const [descargando, setDescargando] = useState(false);
  const [resolviendoId, setResolviendoId] = useState<string | null>(null);
  const [borrarTarget, setBorrarTarget] = useState<AsistenciaRegistro | null>(null);

  const filtrosActivos = empleadoFiltro !== "todos" || sucursalFiltro !== "todos" || tipoFiltro !== "todos";

  function limpiarFiltros() {
    setEmpleadoFiltro("todos");
    setSucursalFiltro("todos");
    setTipoFiltro("todos");
    setPage(1);
  }

  async function handleDescargarExcel() {
    setDescargando(true);
    try {
      await exportarAsistencia(desde, hasta);
      toast.success("Excel descargado.");
    } catch {
      toast.error("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }

  async function handleBorrar() {
    if (!borrarTarget) return;
    try {
      await borrar.mutateAsync(borrarTarget.id);
      toast.success("Registro borrado.");
      setBorrarTarget(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo borrar el registro.");
    }
  }

  async function handleResolver(id: string, accion: "aprobar" | "descartar") {
    setResolviendoId(id);
    try {
      await resolver.mutateAsync({ id, accion });
      toast.success(accion === "aprobar" ? "Intento aprobado." : "Intento descartado.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo resolver el intento.");
    } finally {
      setResolviendoId(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Asistencia"
        actions={
          <Button
            variant="secondary"
            onClick={handleDescargarExcel}
            disabled={descargando || sinReportes || !gestionable}
            title={
              !gestionable
                ? "Tu rol no tiene acceso a exportar."
                : sinReportes
                  ? "Exportar es una función del plan Básico. Pasate a un plan superior para usarla."
                  : undefined
            }
          >
            <Download className="h-4 w-4" />
            {descargando ? "Generando…" : "Descargar Excel"}
          </Button>
        }
      />

      <div className="mt-6">
        <Tabs
          value={vista}
          onChange={setVista}
          items={[
            { value: "registros", label: "Registros" },
            { value: "rechazadas", label: "Rechazadas", count: rechazadasData?.pagination.total },
          ]}
        />
      </div>

      {vista === "registros" && (
        <section className="page-section">
          <Toolbar>
            <Field
              label="Desde"
              type="date"
              value={desde}
              onChange={(e) => { setDesde(e.target.value); setPage(1); }}
              containerClassName="w-40"
            />
            <Field
              label="Hasta"
              type="date"
              value={hasta}
              onChange={(e) => { setHasta(e.target.value); setPage(1); }}
              containerClassName="w-40"
            />
            <Select
              label="Empleado"
              value={empleadoFiltro}
              onChange={(e) => { setEmpleadoFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...empleados.map((emp) => ({ value: emp.id, label: emp.nombre }))]}
              containerClassName="w-44"
            />
            <Select
              label="Sucursal"
              value={sucursalFiltro}
              onChange={(e) => { setSucursalFiltro(e.target.value); setPage(1); }}
              options={[{ value: "todos", label: "Todos" }, ...sucursales.map((suc) => ({ value: suc.id, label: suc.nombre }))]}
              containerClassName="w-44"
            />
            <Select
              label="Tipo"
              value={tipoFiltro}
              onChange={(e) => { setTipoFiltro(e.target.value as TipoFiltro); setPage(1); }}
              options={[
                { value: "todos", label: "Todos" },
                { value: "entrada", label: "Entrada" },
                { value: "salida", label: "Salida" },
              ]}
              containerClassName="w-36"
            />
            <div className="ml-auto flex items-center gap-3">
              {filtrosActivos && <ClearFiltersButton onClick={limpiarFiltros} />}
              <span className="font-mono text-xs text-text-tertiary">{data?.pagination.total ?? 0} resultados</span>
            </div>
          </Toolbar>

          {isError && <p className="mt-2 text-[15px] text-alert">No se pudieron cargar los registros. Probá de nuevo.</p>}

          <Table containerClassName="mt-4">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha y hora</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading && <TableSkeleton cols={5} />}
              {!isLoading &&
                grupos.map((grupo) => (
                  <Fragment key={grupo.fecha}>
                    <TableRow className="hover:bg-transparent">
                      <TableCell
                        colSpan={5}
                        className="border-b-0 bg-surface py-2 text-[11px] font-semibold uppercase tracking-wide text-text-tertiary"
                      >
                        {grupo.fecha}
                      </TableCell>
                    </TableRow>
                    {grupo.registros.map((r) => (
                      <TableRow key={r.id} className="cursor-pointer" onClick={() => setDetalle(r)}>
                        <TableCell>{horaLocal(r.created_at)}</TableCell>
                        <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                        <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                        <TableCell>
                          {r.tipo === "entrada" ? (
                            <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-success-700">
                              <LogIn className="h-3 w-3" /> Entrada
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-text-secondary">
                              <LogOut className="h-3 w-3" /> Salida
                            </span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex justify-end">
                            {gestionable && (
                              <Button
                                variant="secondary"
                                size="default"
                                onClick={(e) => { e.stopPropagation(); setBorrarTarget(r); }}
                              >
                                Borrar
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </Fragment>
                ))}
              {!isLoading && registros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-text-tertiary">
                    No hay registros en este rango.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {data && <Pagination pagination={data.pagination} onPageChange={setPage} onPageSizeChange={(s) => { setPageSize(s); setPage(1); }} />}
        </section>
      )}

      {vista === "rechazadas" && (
        <section className="page-section">
          <Table containerClassName="mt-2">
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Empleado</TableHead>
                <TableHead>Sucursal</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rechazadas.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>{horaLocal(r.created_at)}</TableCell>
                  <TableCell>{r.empleado_nombre ?? "—"}</TableCell>
                  <TableCell>{r.sucursal_nombre ?? "—"}</TableCell>
                  <TableCell>
                    {MOTIVOS_RECHAZO[r.motivo] ?? r.motivo}
                    {r.motivo === "fuera_de_rango" && r.distancia_metros != null && (
                      <span className="text-text-tertiary"> (a {r.distancia_metros} m)</span>
                    )}
                    {r.tipo && <span className="text-text-tertiary"> — {r.tipo}</span>}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="secondary"
                        size="default"
                        onClick={() => handleResolver(r.id, "aprobar")}
                        disabled={resolviendoId === r.id}
                      >
                        {resolviendoId === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                        Aprobar
                      </Button>
                      <Button
                        variant="secondary"
                        size="default"
                        onClick={() => handleResolver(r.id, "descartar")}
                        disabled={resolviendoId === r.id}
                      >
                        Descartar
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rechazadas.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-text-tertiary">
                    No hay marcas rechazadas pendientes.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {rechazadasData && (
            <Pagination
              pagination={rechazadasData.pagination}
              onPageChange={setRechazadasPage}
              onPageSizeChange={(s) => { setRechazadasPageSize(s); setRechazadasPage(1); }}
            />
          )}
        </section>
      )}

      <SidePanel
        open={detalle != null}
        onClose={() => setDetalle(null)}
        title="Detalle de marca"
        footer={
          gestionable && detalle ? (
            <Button
              variant="secondary"
              block
              onClick={() => {
                setBorrarTarget(detalle);
                setDetalle(null);
              }}
            >
              Borrar registro
            </Button>
          ) : undefined
        }
      >
        {detalle && (
          <dl className="flex flex-col gap-4 text-[13.5px]">
            <div>
              <dt className="text-text-tertiary">Empleado</dt>
              <dd className="font-medium text-text">{detalle.empleado_nombre ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Sucursal</dt>
              <dd className="font-medium text-text">{detalle.sucursal_nombre ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Tipo</dt>
              <dd className="font-medium text-text">{detalle.tipo === "entrada" ? "Entrada" : "Salida"}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Fecha y hora</dt>
              <dd className="font-medium text-text">{horaLocal(detalle.created_at)}</dd>
            </div>
            <div>
              <dt className="text-text-tertiary">Ubicación registrada</dt>
              <dd className="font-mono text-text-secondary">
                {detalle.lat.toFixed(5)}, {detalle.lon.toFixed(5)}
              </dd>
            </div>
          </dl>
        )}
      </SidePanel>

      <Dialog open={borrarTarget != null} onClose={() => setBorrarTarget(null)} title="Borrar registro">
        <p className="text-[15px] text-text-secondary">
          ¿Borrar el registro de {borrarTarget?.tipo === "entrada" ? "entrada" : "salida"} de{" "}
          <strong>{borrarTarget?.empleado_nombre ?? "este empleado"}</strong> del{" "}
          {borrarTarget ? horaLocal(borrarTarget.created_at) : ""}? Esta acción no se puede deshacer.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setBorrarTarget(null)}>
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleBorrar} disabled={borrar.isPending}>
            {borrar.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Borrar
          </Button>
        </div>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 2: Verificar que compila**

```bash
rm -f node_modules/.tmp/*.tsbuildinfo
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/asistencia/AsistenciaPage.tsx
git commit -m "feat: SidePanel de detalle y agrupación por fecha en Asistencia"
```

---

## Al terminar esta etapa

Con esto queda cerrada la Etapa 3 (Dashboard + Asistencia). La Etapa 4 (Turnos + Horas) se planifica en su propio documento una vez revisada esta, mismo patrón que las etapas anteriores.
