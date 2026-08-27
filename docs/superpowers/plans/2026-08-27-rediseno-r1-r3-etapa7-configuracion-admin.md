# Etapa 7 del rediseño R1/R3: Configuración + Admin — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skinear Configuración y Admin (Organizaciones + detalle de organización) con los componentes compartidos ya establecidos en las etapas anteriores del rediseño (`Tabs`, `Toolbar`, `Field`/`Select` compact, `PersonCell`, breadcrumb de `PageHeader`), sin cambiar UX ni lógica de negocio.

**Architecture:** Tres tasks independientes, cada una modifica un solo archivo de página. No hay cambios de backend, hooks, ni tipos compartidos — solo reorganización visual/estructural de páginas ya funcionales, reutilizando componentes que ya existen en `src/components/ui/`.

**Tech Stack:** React 19 + TypeScript + Tailwind v4, `@tanstack/react-query` v5, `react-router-dom` v7. Mismo stack que el resto del rediseño.

**Spec:** `docs/superpowers/specs/2026-08-26-rediseno-r1-r3-design.md` (Etapa 7: Configuración + Admin — re-skin visual, "sin cambios de UX/lógica").

## Global Constraints

- **Sin cambios de backend.** Ningún endpoint nuevo, ningún cambio de query params, ningún cambio de schema. Todo lo que se muestra ya viene de hooks/queries existentes.
- **Sin cambios de UX ni de lógica de negocio.** Esta etapa es re-skin puro: mismos formularios, misma validación, mismas mutaciones, mismos flujos. Solo cambia cómo se organizan visualmente.
- **Reusar componentes compartidos existentes** (`Tabs`, `Toolbar`, `Field`/`Select` con `compact`, `PersonCell`, `IconButton`, `StatRow`, `Badge`/`Status`, `PageHeader` con `breadcrumb`) — no crear componentes nuevos.
- **El `kicker` de `PageHeader` se mantiene** en todas las páginas de esta etapa (confirmado: `SucursalesPage.tsx` de Etapa 6 lo conserva — no es un patrón a remover).
- **No agregar la pestaña "Categorías" a Configuración.** Etapa 6 consolidó la gestión de categorías de motivo exclusivamente en la página Ausencias (`RrhhPage.tsx`). R3 todavía muestra una 3ra pestaña de categorías en su `Configuracion.tsx` — eso contradice una decisión ya tomada y no se replica acá.
- **No agregar filtros de plan/estado a `AdminPage.tsx`.** R3 los filtra client-side sobre datos mock ya completos en memoria; nuestra lista de organizaciones es paginada server-side (`listOrganizationsAdmin`), así que un filtro client-side de plan/estado solo filtraría la página actual, no el set completo — sería un comportamiento incorrecto, no una mejora visual. Se mantiene solo el filtro de búsqueda por texto que ya existe.
- **No agregar `StatRow` de stats globales a `AdminPage.tsx`.** Calcular "empleados totales"/"suscripciones en riesgo" sobre todas las organizaciones requeriría traer el set completo sin paginar más N llamadas por organización (N+1) — cambia el patrón de carga de la página y no es un ajuste visual liviano. Queda fuera de alcance.
- **`PlanPage.tsx` no se toca en esta etapa.** Ya usa `Card`, `Badge variant="accent"`, tipografía y densidad consistentes con el sistema de diseño post-fidelidad. No hay brecha real que justifique un task.

---

### Task 1: ConfiguracionPage — pestañas Organización/Equipo + Zona sensible

**Files:**
- Modify: `src/pages/configuracion/ConfiguracionPage.tsx`

**Interfaces:**
- Consumes: `Tabs` de `../../components/ui/tabs` (prop `items: {value, label, count?}[]`, `value`, `onChange`). Todo lo demás (hooks, mutaciones, `Dialog`s) ya existe en el archivo y no cambia.
- Produces: nada que otros tasks consuman (task independiente).

**Contexto:** Hoy la página apila 3 `Card`s siempre visibles (Organización, Equipo, Otras configuraciones). R3 (`~/Desktop/R3/src/pages/Configuracion.tsx`) usa `Tabs` para separar Organización/Miembros, y agrega una sección "Zona sensible" (baja de organización) dentro de la pestaña Organización que hoy no existe en nuestra página. Vamos a adoptar el patrón de pestañas (ya usado en `RrhhPage.tsx` y `EmpleadoDetallePage.tsx`) y agregar la Zona sensible como un `mailto:` — mismo patrón ya usado en `PlanPage.tsx` ("Contactanos para cambiar de plan"), sin depender de ningún endpoint nuevo.

- [ ] **Step 1: Agregar el import de `Tabs` y el estado de pestaña activa**

En `src/pages/configuracion/ConfiguracionPage.tsx`, agregar el import junto a los demás:

```tsx
import { Tabs } from "../../components/ui/tabs";
```

Dentro del componente, junto a los demás `useState`, agregar:

```tsx
  const [tab, setTab] = useState<"organizacion" | "equipo">("organizacion");
```

- [ ] **Step 2: Reemplazar el bloque de `return` para usar pestañas**

Reemplazar todo el bloque desde `<PageHeader .../>` hasta el cierre del `</Card>` de "Otras configuraciones" (líneas ~95-196 del archivo actual) por:

```tsx
      <PageHeader kicker="Espacio de trabajo" title="Configuración" description="Organización, equipo y permisos." />

      <div className="mt-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "organizacion", label: "Organización" },
            { value: "equipo", label: "Equipo", count: puedeVerEquipo ? miembros.length : undefined },
          ]}
        />
      </div>

      {tab === "organizacion" && (
        <>
          <Card className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[15px] text-text">{org?.name ?? "—"}</p>
              <Button
                variant="secondary"
                onClick={abrirEditarOrg}
                disabled={!esOwner}
                title={!esOwner ? "Solo el dueño de la organización puede editar este dato." : undefined}
              >
                Editar
              </Button>
            </div>
          </Card>

          <Card className="mt-4">
            <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-text">Otras configuraciones</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Link
                to="/turnos"
                className="flex items-center gap-3 rounded-[6px] border border-border px-4 py-3 transition-colors hover:bg-text/[.04]"
              >
                <CalendarDays className="h-[18px] w-[18px] text-accent-700" />
                <span className="flex-1">
                  <span className="block text-[14px] font-semibold text-text">Tolerancia de horarios</span>
                  <span className="block text-[12.5px] text-text-secondary">Se administra desde Turnos</span>
                </span>
                <ChevronRight className="h-4 w-4 text-text-tertiary" />
              </Link>
            </div>
          </Card>

          {esOwner && (
            <Card className="mt-4 border-alert/30">
              <h2 className="text-[16px] font-semibold tracking-[-0.02em] text-alert">Zona sensible</h2>
              <p className="mt-1 text-[13.5px] text-text-secondary">
                ¿Necesitás dar de baja esta organización? Escribinos y nos encargamos del resto.
              </p>
              <Button variant="secondary" className="mt-3" asChild>
                <a
                  href={`mailto:soporte@oliver.app?subject=${encodeURIComponent(
                    `Baja de organización: ${org?.name ?? ""}`
                  )}`}
                >
                  Solicitar baja de la organización
                </a>
              </Button>
            </Card>
          )}
        </>
      )}

      {tab === "equipo" && puedeVerEquipo && (
        <Card className="mt-4">
          <div className="flex items-start justify-between gap-3">
            <p className="text-[13.5px] text-text-secondary">
              Quién tiene acceso al panel de esta organización. Por ahora todos los miembros invitados
              tienen el mismo acceso, sin importar el rol.
            </p>
            {esOwner && (
              <Button variant="secondary" onClick={() => { setErrorInvitar(null); setInvitarOpen(true); }}>
                <Plus className="h-4 w-4" />
                Invitar
              </Button>
            )}
          </div>

          <Table containerClassName="mt-3">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Rol</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {miembrosLoading && <TableSkeleton cols={5} />}
              {!miembrosLoading &&
                miembros.map((m) => (
                  <TableRow key={m.userId}>
                    <TableCell>
                      {m.email}
                      {m.userId === user?.id && <span className="text-text-tertiary"> (vos)</span>}
                    </TableCell>
                    <TableCell>
                      <Badge variant={m.role === "owner" ? "accent" : "neutral"}>{ROL_LABEL[m.role]}</Badge>
                    </TableCell>
                    <TableCell>
                      <Status tone={m.activo ? "success" : "warning"}>{m.activo ? "Activo" : "Pendiente"}</Status>
                    </TableCell>
                    <TableCell>{fechaLocal(m.createdAt)}</TableCell>
                    <TableCell className="text-right">
                      {esOwner && m.role !== "owner" && (
                        <IconButton
                          onClick={() => setQuitarTarget(m)}
                          icon={<Trash2 className="h-3.5 w-3.5" />}
                          label="Quitar de la organización"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              {!miembrosLoading && miembros.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-8 text-center text-text-tertiary">
                    Todavía no hay miembros cargados.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
```

Notar: se removieron los `<h2>Organización</h2>` y `<h2>Equipo</h2>` internos porque ahora la pestaña activa ya cumple ese rol de título — dejarlos sería redundante. El resto del archivo (los 4 `Dialog`s al final: editar org, invitar, quitar, y sus handlers) no cambia.

- [ ] **Step 2b: Verificar que `text-alert` y `border-alert` existen como tokens**

Correr:

```bash
grep -n "alert" src/index.css
```

Expected: aparece `--color-alert` (o equivalente) definido como token de Tailwind v4. El archivo ya usa `text-alert` en varios lugares (`errorOrg`, `errorInvitar`), así que el token existe — `border-alert/30` es la misma variable con opacidad, sintaxis válida de Tailwind v4.

- [ ] **Step 3: Build y verificación manual**

```bash
npm run build
```

Expected: build limpio, sin errores de TypeScript (los imports `ChevronRight`, `CalendarDays`, `Link` siguen usándose; no queda ningún import sin usar).

- [ ] **Step 4: Commit**

```bash
git add src/pages/configuracion/ConfiguracionPage.tsx
git commit -m "feat: Configuración usa pestañas Organización/Equipo + zona sensible (Etapa 7 rediseño R1/R3)"
```

---

### Task 2: AdminPage — Toolbar compacto + fila clickeable

**Files:**
- Modify: `src/pages/admin/AdminPage.tsx`

**Interfaces:**
- Consumes: `Toolbar` de `../../components/ui/toolbar`, `Field` con `compact` de `../../components/ui/field` (ya soportan estos props, ver Task 1's contexto — mismo componente).
- Produces: nada que otros tasks consuman (task independiente de Task 1 y Task 3; toca un archivo distinto).

**Contexto:** El filtro de búsqueda hoy es un `Field` suelto con label visible dentro de un `div` ad-hoc (no usa el componente `Toolbar` que ya usan `EmpleadosPage.tsx`, `SucursalesPage.tsx`, `RrhhPage.tsx`). Las acciones de fila son dos `IconButton`s siempre visibles (Editar + Ver detalle) en vez de fila-clickeable + acción secundaria hover-revelada — el patrón que ya usan `SucursalesPage.tsx` y `RrhhPage.tsx` desde Etapa 6. `TableRow` ya trae la clase `group` incorporada, así que el hover-reveal de la acción de Editar funciona sin tocar `table.tsx`.

- [ ] **Step 1: Reemplazar imports**

Reemplazar:

```tsx
import { Plus, Pencil, Search, Loader2 } from "lucide-react";
```

por:

```tsx
import { Plus, Pencil, Search, Loader2 } from "lucide-react";
import { Toolbar } from "../../components/ui/toolbar";
```

(agregar el import de `Toolbar` junto a los demás imports de `../../components/ui/*`, no reemplazar el de lucide-react — mismo símbolo, se mantiene).

- [ ] **Step 2: Reemplazar el bloque de filtro**

Reemplazar:

```tsx
      <div className="mt-4 flex flex-wrap items-end gap-2">
        <Field
          label="Buscar"
          placeholder="Nombre o slug"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
      </div>
```

por:

```tsx
      <Toolbar className="mt-4">
        <Field
          label="Buscar"
          compact
          placeholder="Nombre o slug"
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPage(1); }}
          containerClassName="w-64"
          icon={<Search className="h-[15px] w-[15px]" />}
        />
        <div className="ml-auto">
          <span className="font-mono text-xs text-text-tertiary">
            {data?.pagination.total ?? 0} organizaciones
          </span>
        </div>
      </Toolbar>
```

- [ ] **Step 3: Reemplazar la fila de tabla para navegar al click**

Reemplazar:

```tsx
              <TableRow key={org.id}>
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.slug}</TableCell>
                <TableCell className="capitalize">{org.plan}</TableCell>
                <TableCell>
                  <Vencimiento orgId={org.id} />
                </TableCell>
                <TableCell>
                  <Uso orgId={org.id} />
                </TableCell>
                <TableCell>{fechaLocal(org.created_at)}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1.5">
                    <IconButton onClick={() => abrirEditarOrg(org)} icon={<Pencil className="h-3.5 w-3.5" />} label="Editar organización" />
                    <IconButton
                      onClick={() => navigate(`/admin/organizaciones/${org.id}`)}
                      icon={<Search className="h-3.5 w-3.5" />}
                      label="Ver detalle"
                    />
                  </div>
                </TableCell>
              </TableRow>
```

por:

```tsx
              <TableRow
                key={org.id}
                role="button"
                tabIndex={0}
                className="cursor-pointer"
                onClick={() => navigate(`/admin/organizaciones/${org.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(`/admin/organizaciones/${org.id}`);
                  }
                }}
              >
                <TableCell>{org.name}</TableCell>
                <TableCell>{org.slug}</TableCell>
                <TableCell className="capitalize">{org.plan}</TableCell>
                <TableCell>
                  <Vencimiento orgId={org.id} />
                </TableCell>
                <TableCell>
                  <Uso orgId={org.id} />
                </TableCell>
                <TableCell>{fechaLocal(org.created_at)}</TableCell>
                <TableCell
                  className="text-right"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => e.stopPropagation()}
                >
                  <div className="flex justify-end opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                    <IconButton onClick={() => abrirEditarOrg(org)} icon={<Pencil className="h-3.5 w-3.5" />} label="Editar organización" />
                  </div>
                </TableCell>
              </TableRow>
```

Nota: `navigate` ya está definido en el componente (`const navigate = useNavigate();`) — no hace falta agregarlo.

- [ ] **Step 4: Build y verificación**

```bash
npm run build
```

Expected: build limpio. El import `Search` de lucide-react sigue en uso (icono del campo de búsqueda). `IconButton` sigue en uso (una sola vez ahora, Editar).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/AdminPage.tsx
git commit -m "feat: AdminPage usa Toolbar compacto y fila clickeable para navegar al detalle (Etapa 7 rediseño R1/R3)"
```

---

### Task 3: OrganizacionDetallePage — Tabs compartido + breadcrumb + PersonCell

**Files:**
- Modify: `src/pages/admin/OrganizacionDetallePage.tsx`

**Interfaces:**
- Consumes: `Tabs` de `../../components/ui/tabs`, `PersonCell` de `../../components/ui/avatar`, prop `breadcrumb` de `PageHeader` (ya soportado, ver `src/components/PageHeader.tsx` — `breadcrumb?: {label: string, href?: string}[]`, usado igual en `EmpleadoDetallePage.tsx` y `SucursalDetallePage.tsx`).
- Produces: nada que otros tasks consuman (task independiente).

**Contexto:** Hoy el cambio de pestaña es manual con 4 `Button`s (`variant={tab === X ? "primary" : "secondary"}`) en vez del componente `Tabs` compartido que ya usan `RrhhPage.tsx` y `EmpleadoDetallePage.tsx`. La navegación "volver" es un `<Link>` con `ChevronLeft` armado a mano en vez del prop `breadcrumb` de `PageHeader`, que ya es el patrón establecido en las páginas de detalle de Etapa 5 y 6. La pestaña de Empleados muestra el nombre como texto plano en vez de `PersonCell` (avatar + nombre), que es el patrón ya usado en todas las tablas de persona del resto del sitio. Ninguno de estos cambios toca lógica: mismas queries, mismos tabs (Miembros/Empleados/Sucursales/Suscripción — se mantienen los 4, la pestaña Suscripción con alta/baja de suscripciones reales es más funcionalidad que el modal mock de R3 y no se resigna).

- [ ] **Step 1: Reemplazar imports**

Reemplazar:

```tsx
import { ChevronLeft, Loader2, Plus } from "lucide-react";
```

por:

```tsx
import { Loader2, Plus } from "lucide-react";
```

Agregar, junto a los demás imports de `../../components/ui/*`:

```tsx
import { Tabs } from "../../components/ui/tabs";
import { PersonCell } from "../../components/ui/avatar";
```

`Link` sigue en uso (el link "Volver al panel" del estado "org no encontrada" en R3 no existe en nuestra versión — nuestra página no tiene ese estado de "no encontrada" hoy; no agregarlo, fuera de alcance). Verificar que `Link` de `react-router-dom` sigue usándose en algún otro lado del archivo; si no, quitar el import. (No lo usa en ningún otro lado del archivo actual — quitarlo también.)

Import final de react-router-dom:

```tsx
import { useParams } from "react-router-dom";
```

- [ ] **Step 2: Reemplazar el encabezado y el selector de pestañas**

Reemplazar:

```tsx
  return (
    <>
      <Link to="/admin" className="inline-flex items-center gap-1 text-[13px] text-text-secondary hover:text-text">
        <ChevronLeft className="h-4 w-4" />
        Organizaciones
      </Link>

      <div className="mt-4">
        <PageHeader kicker="Superadmin" title={org?.name ?? "Organización"} />
      </div>

      <div className="mt-4 flex gap-2">
        <Button variant={tab === "miembros" ? "primary" : "secondary"} onClick={() => setTab("miembros")}>
          Miembros
        </Button>
        <Button variant={tab === "empleados" ? "primary" : "secondary"} onClick={() => setTab("empleados")}>
          Empleados
        </Button>
        <Button variant={tab === "sucursales" ? "primary" : "secondary"} onClick={() => setTab("sucursales")}>
          Sucursales
        </Button>
        <Button variant={tab === "suscripcion" ? "primary" : "secondary"} onClick={() => setTab("suscripcion")}>
          Suscripción
        </Button>
      </div>

      {tab === "miembros" && <MiembrosTab orgId={orgId} />}
      {tab === "empleados" && <EmpleadosTab orgId={orgId} />}
      {tab === "sucursales" && <SucursalesTab orgId={orgId} />}
      {tab === "suscripcion" && org && <SuscripcionTab orgId={orgId} orgName={org.name} />}
    </>
  );
```

por:

```tsx
  return (
    <>
      <PageHeader
        kicker="Superadmin"
        breadcrumb={[{ label: "Organizaciones", href: "/admin" }]}
        title={org?.name ?? "Organización"}
      />

      <div className="mt-4">
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "miembros", label: "Miembros" },
            { value: "empleados", label: "Empleados" },
            { value: "sucursales", label: "Sucursales" },
            { value: "suscripcion", label: "Suscripción" },
          ]}
        />
      </div>

      {tab === "miembros" && <MiembrosTab orgId={orgId} />}
      {tab === "empleados" && <EmpleadosTab orgId={orgId} />}
      {tab === "sucursales" && <SucursalesTab orgId={orgId} />}
      {tab === "suscripcion" && org && <SuscripcionTab orgId={orgId} orgName={org.name} />}
    </>
  );
```

Nota: no se agregan `count` a los items del `Tabs` — cada sub-tab pagina su propia query de forma independiente (`useMiembrosAdminOrg`, `useEmpleadosAdminOrg`, `useSucursalesAdminOrg`), así que no hay un total ya cargado disponible en el componente padre sin duplicar esas queries acá arriba. Dejar los tabs sin badge de conteo es la opción conservadora — coherente con "sin cambios de UX/lógica" (no se agregan queries nuevas solo para mostrar un número).

`Button` sigue en uso más abajo (el botón "Editar organización" no existe en esta página — verificar: el único uso de `Button` en el resto del archivo es dentro de `SuscripcionTab`, así que el import se mantiene).

- [ ] **Step 3: `PersonCell` en la pestaña Empleados**

Dentro de `EmpleadosTab`, reemplazar:

```tsx
              <TableCell>{nombreCompleto(e)}</TableCell>
```

por:

```tsx
              <TableCell>
                <PersonCell nombre={nombreCompleto(e)} />
              </TableCell>
```

- [ ] **Step 4: Build y verificación**

```bash
npm run build
```

Expected: build limpio, sin imports sin usar (`ChevronLeft` y `Link` ya no se usan y fueron removidos en Step 1).

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/OrganizacionDetallePage.tsx
git commit -m "feat: OrganizacionDetallePage usa Tabs compartido, breadcrumb y PersonCell (Etapa 7 rediseño R1/R3)"
```

---

## Nota sobre `.env.local`

Este worktree fue creado sin copiar `.env.local` (el archivo está bloqueado por configuración de permisos del entorno de esta sesión — no es un problema del repo). `npm run build` no lo necesita. Antes de levantar `npm run dev` para probar esta etapa en el navegador, copiar manualmente `.env.local` desde `.worktrees/rediseno-r1-r3-etapa4/.env.local` a este worktree.
