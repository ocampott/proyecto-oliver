# Buscador de dirección (Places API New) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reemplazar el buscador de direcciones 100% client-side de `MapaUbicacion.tsx` (widget `PlaceAutocompleteElement`) por un flujo optimizado en costo: Autocomplete (New) por `fetch` directo desde el navegador con la key del frontend, y Place Details resuelto en el backend con la key de servidor — ambas etapas atadas por un mismo session token generado por nosotros.

**Architecture:** `server/src/routes/places.ts` ya implementa `POST /api/places/details` completo (field mask correcto, validación de `sessionToken`); solo falta registrarlo en `server/src/index.ts`. `web/src/lib/api.ts` gana `getPlaceDetails(placeId, sessionToken)`. `web/src/components/MapaUbicacion.tsx` reemplaza el widget de Google por un input propio + dropdown de sugerencias, que llama al endpoint REST `places:autocomplete` de Google directo por `fetch` (sin el SDK JS de Places) y a `getPlaceDetails` al seleccionar.

**Tech Stack:** Sin dependencias nuevas — `@googlemaps/js-api-loader` (ya instalado) queda solo para la librería `maps` (Map/Marker/Circle); Autocomplete New se llama por `fetch` plano contra `places.googleapis.com`.

**Spec:** `docs/superpowers/specs/2026-08-20-mapa-ubicacion-places-autocomplete.md`

## Global Constraints

- **El session token es un string propio (`crypto.randomUUID()`), no `google.maps.places.AutocompleteSessionToken`** — ese objeto del SDK JS es opaco y solo sirve para uso interno del SDK; no se puede reenviar al backend. Ver spec §2.
- **Nombres de env vars ya establecidos, no se renombran**: `VITE_GOOGLE_MAPS_API_KEY` (frontend) / `GOOGLE_MAPS_API_KEY` (backend), ya en ambos `.env.example`.
- **`server/src/routes/places.ts` no se modifica** — ya cumple el spec tal cual está (field mask, validación UUID del sessionToken, response shape). Solo se registra.
- **Sin tests automatizados** (convención del repo: `server/`/`web/` no tienen suite de tests) — verificación vía `typecheck`/`build` por task y checklist manual en navegador al final, con API keys reales cargadas por el usuario.
- **No se toca el geocoding reverso** (click en mapa / drag del pin) — sigue usando las coordenadas del evento directamente, sin llamar a Places (fuera de alcance, spec §5).
- Este plan corre en el directorio principal del repo (`feat/sucursales-mapa-ubicacion`, sin worktree), no en un worktree — coordinar con el usuario antes de tocar git en este directorio si hay otra sesión activa en paralelo.
- **Agregado tras QA manual (Tasks 5-7):** la dirección mostrada en el input de `MapaUbicacion` se persiste en `sucursales.direccion` (columna nueva, migración `0006_sucursales_direccion.sql`) — NO se resuelve con reverse-geocoding. Decisión explícita del usuario: en el alta no se precarga ninguna "dirección cercana" a partir de la geolocalización automática porque eso requeriría una llamada extra a la Geocoding API (costo); en la edición sí se precarga, pero leyendo el valor ya guardado en la base (gratis, sin llamar a Google).
- **Numeración de migraciones:** esta rama se creó antes del merge de Turnos a `main`, así que `supabase/migrations/` no tenía `0004_turnos.sql` ni la `0005_rrhh.sql` del módulo RRHH (aplicada al Supabase remoto compartido desde otro worktree, aunque esa rama todavía no esté mergeada a `main`). Ambos archivos ya se copiaron a esta rama tal cual están aplicados (commit `chore(db): reconciliar migraciones...`) para que `supabase db push`/`db pull` no bloqueen por desincronización de historial. La migración nueva de esta feature quedó numerada `0006`, no `0004`.

---

## Task 1: Backend — registrar `/api/places/details`

**Files:**
- Modify: `server/src/index.ts`

**Interfaces:**
- Consumes: `placesRoutes` (ya exportado por `server/src/routes/places.ts`, ya importado en `index.ts` línea 13).
- Produces: ruta `POST /api/places/details` activa (consumida por `getPlaceDetails` en la Task 2).

- [ ] **Step 1: Registrar la ruta**

En `server/src/index.ts`, agregar la línea `await app.register(placesRoutes);` después de `await app.register(adminRoutes);` (línea 35), junto con el resto de los `register`:

```ts
await app.register(meRoutes);
await app.register(orgRoutes);
await app.register(marcarRoutes);
await app.register(sucursalesRoutes);
await app.register(empleadosRoutes);
await app.register(asistenciaRoutes);
await app.register(horasRoutes);
await app.register(adminRoutes);
await app.register(placesRoutes);
```

- [ ] **Step 2: Typecheck y build del server**

```bash
cd server && npm run build
```

Esperado: sin errores.

- [ ] **Step 3: Levantar el server y confirmar que la ruta responde**

```bash
cd server && npm run dev
```

En otra terminal:

```bash
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:3020/api/health
```

(Usa el puerto de `server/.env.local`, `PORT=3020` en este directorio — ajustar si cambió.) Con el server arriba, probar sin token de auth:

```bash
curl -s -X POST http://localhost:3020/api/places/details -H "Content-Type: application/json" -d '{}'
```

Esperado: `{"error":"No autorizado"}` con status 401 — confirma que la ruta existe y está detrás de `requireAuth` (antes de este cambio daba 404 porque no estaba registrada).

- [ ] **Step 4: Commit**

```bash
git add server/src/index.ts
git commit -m "feat(server): registrar ruta /api/places/details"
```

---

## Task 2: `web/src/lib/api.ts` — `getPlaceDetails`

**Files:**
- Modify: `web/src/lib/api.ts`

**Interfaces:**
- Consumes: `request<T>(path, init)` (helper ya existente en el mismo archivo, línea 14).
- Produces: `getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails>` — usado por `MapaUbicacion.tsx` en la Task 3.

- [ ] **Step 1: Agregar el tipo y la función**

Al final de `web/src/lib/api.ts`, agregar:

```ts
export interface PlaceDetails {
  formattedAddress: string | null;
  lat: number | null;
  lng: number | null;
  addressComponents: unknown[];
}

export function getPlaceDetails(placeId: string, sessionToken: string): Promise<PlaceDetails> {
  return request("/api/places/details", {
    method: "POST",
    body: JSON.stringify({ placeId, sessionToken }),
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd web && npx tsc -b --noEmit
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add web/src/lib/api.ts
git commit -m "feat(web): getPlaceDetails en api.ts"
```

---

## Task 3: `MapaUbicacion.tsx` — buscador con Autocomplete (New) + sesión

**Files:**
- Modify: `web/src/components/MapaUbicacion.tsx`

**Interfaces:**
- Consumes: `getPlaceDetails(placeId, sessionToken)` de la Task 2; `setOptions`/`importLibrary` de `@googlemaps/js-api-loader` (sin cambios, solo se deja de pedir la librería `places`).
- Produces: mismo export público que hoy — `Coordenadas`, `MapaUbicacion({ value, onChange, radioMetros })` — sin cambios de firma, así que `SucursalesPage.tsx` no se toca en este task.

- [ ] **Step 1: Reemplazar el contenido de `web/src/components/MapaUbicacion.tsx`**

```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { getPlaceDetails } from "../lib/api";

export interface Coordenadas {
  lat: number;
  lon: number;
}

interface MapaUbicacionProps {
  /** Ubicación seleccionada, o null si todavía no se eligió ninguna. */
  value: Coordenadas | null;
  onChange: (coords: Coordenadas) => void;
  /** Radio de cobertura en metros: se dibuja como círculo alrededor del pin. */
  radioMetros?: number;
}

// Centro por defecto cuando no hay geolocalización disponible (Buenos Aires).
const DEFAULT_CENTER: Coordenadas = { lat: -34.6037, lon: -58.3816 };
const DEFAULT_ZOOM = 12;
const ZOOM_UBICACION = 16;
const DEBOUNCE_MS = 300;

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Carga única del script de Google Maps para toda la app. Solo la librería
// "maps" (Map/Marker/Circle) — el buscador de direcciones no usa el SDK de
// Places, llama directo por fetch al endpoint REST (ver fetchSugerencias).
let googleMapsPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (!googleMapsPromise) {
    setOptions({ key: API_KEY ?? "", v: "weekly", language: "es" });
    googleMapsPromise = importLibrary("maps").then(() => undefined);
  }
  return googleMapsPromise;
}

interface Sugerencia {
  placeId: string;
  texto: string;
}

interface AutocompleteSuggestionsResponse {
  suggestions?: Array<{
    placePrediction?: { placeId: string; text: { text: string } };
  }>;
}

// Autocomplete (New) por REST directo, con la key del frontend (restringida
// por HTTP referrer) y un session token propio — ver spec §2.
async function fetchSugerencias(
  input: string,
  sessionToken: string,
  signal: AbortSignal
): Promise<Sugerencia[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": API_KEY ?? "" },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ["ar"],
      languageCode: "es",
    }),
  });
  if (!res.ok) throw new Error("Falló places:autocomplete");
  const data = (await res.json()) as AutocompleteSuggestionsResponse;
  const sugerencias: Sugerencia[] = [];
  for (const s of data.suggestions ?? []) {
    if (s.placePrediction) {
      sugerencias.push({ placeId: s.placePrediction.placeId, texto: s.placePrediction.text.text });
    }
  }
  return sugerencias;
}

/**
 * Selector de ubicación con Google Maps. Si no hay valor inicial intenta usar
 * la geolocalización del navegador; si falla, muestra un centro por defecto y
 * deja elegir el punto manualmente (buscador de direcciones, click en el mapa
 * o arrastrando el pin).
 */
export function MapaUbicacion({ value, onChange, radioMetros }: MapaUbicacionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [cargando, setCargando] = useState(true);
  const [buscandoGeo, setBuscandoGeo] = useState(value == null);
  const [sinGeo, setSinGeo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [direccion, setDireccion] = useState<string | null>(null);

  // Buscador de direcciones.
  const [query, setQuery] = useState("");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!API_KEY) {
      setError("Falta configurar la API key de Google Maps (VITE_GOOGLE_MAPS_API_KEY).");
      setCargando(false);
      setBuscandoGeo(false);
      return;
    }
    if (mapRef.current) return;

    let cancelado = false;
    (async () => {
      try {
        await loadGoogleMaps();
      } catch {
        if (!cancelado) {
          setError("No se pudo cargar Google Maps. Revisá la API key y tu conexión.");
          setCargando(false);
          setBuscandoGeo(false);
        }
        return;
      }
      if (cancelado || !containerRef.current) return;

      const inicial = value ?? DEFAULT_CENTER;
      const map = new google.maps.Map(containerRef.current, {
        center: { lat: inicial.lat, lng: inicial.lon },
        zoom: value ? ZOOM_UBICACION : DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        setDireccion(null);
        onChangeRef.current({ lat: e.latLng.lat(), lon: e.latLng.lng() });
      });
      mapRef.current = map;
      setCargando(false);

      // Sin valor inicial (alta): intentamos centrar en la ubicación actual.
      // Con valor inicial (edición): se respeta lo guardado, sin pedir geo.
      if (value == null) {
        if (!navigator.geolocation) {
          setBuscandoGeo(false);
          setSinGeo(true);
        } else {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setBuscandoGeo(false);
              // Si el usuario ya eligió un punto manualmente, no lo pisamos.
              if (markerRef.current) return;
              const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              map.setCenter({ lat: coords.lat, lng: coords.lon });
              map.setZoom(ZOOM_UBICACION);
              onChangeRef.current(coords);
            },
            () => {
              setBuscandoGeo(false);
              setSinGeo(true);
            },
            { timeout: 8000, maximumAge: 60000 }
          );
        }
      }
    })();

    return () => {
      cancelado = true;
    };
    // El mapa se inicializa una sola vez con el valor de apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el pin y el círculo con el valor seleccionado (sin recentrar).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (value == null) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      circleRef.current?.setMap(null);
      circleRef.current = null;
      return;
    }
    const pos = { lat: value.lat, lng: value.lon };
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      const marker = new google.maps.Marker({ map, position: pos, draggable: true });
      marker.addListener("dragend", () => {
        const p = marker.getPosition();
        if (!p) return;
        setDireccion(null);
        onChangeRef.current({ lat: p.lat(), lon: p.lng() });
      });
      markerRef.current = marker;
    }
    if (circleRef.current) {
      circleRef.current.setCenter(pos);
    } else {
      circleRef.current = new google.maps.Circle({
        map,
        center: pos,
        strokeColor: "#2563eb",
        strokeWeight: 1.5,
        strokeOpacity: 0.7,
        fillColor: "#2563eb",
        fillOpacity: 0.12,
        clickable: false,
      });
    }
  }, [value]);

  // Actualiza el radio del círculo sin tocar nada más.
  useEffect(() => {
    circleRef.current?.setRadius(radioMetros && radioMetros > 0 ? radioMetros : 100);
  }, [radioMetros, value]);

  // Limpieza del debounce/fetch pendiente al desmontar.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function cerrarSugerencias() {
    setSugerenciasAbiertas(false);
    setIndiceActivo(-1);
  }

  function handleQueryChange(texto: string) {
    setQuery(texto);
    setErrorBusqueda(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (texto.trim() === "") {
      sessionTokenRef.current = null;
      setSugerencias([]);
      cerrarSugerencias();
      return;
    }
    // Primer caracter de una búsqueda nueva: token de sesión nuevo.
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = crypto.randomUUID();
    }
    const token = sessionTokenRef.current;
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      fetchSugerencias(texto, token, controller.signal)
        .then((resultados) => {
          if (controller.signal.aborted) return;
          setSugerencias(resultados);
          setSugerenciasAbiertas(true);
          setIndiceActivo(-1);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setErrorBusqueda("No pudimos buscar sugerencias. Probá de nuevo.");
          setSugerencias([]);
        });
    }, DEBOUNCE_MS);
  }

  async function seleccionarSugerencia(sug: Sugerencia) {
    const token = sessionTokenRef.current;
    cerrarSugerencias();
    setQuery(sug.texto);
    setErrorBusqueda(null);
    if (!token) return;
    try {
      const detalle = await getPlaceDetails(sug.placeId, token);
      // Sesión concluida: la próxima búsqueda arranca con un token nuevo.
      sessionTokenRef.current = null;
      if (detalle.lat == null || detalle.lng == null) {
        setErrorBusqueda("Esa dirección no tiene coordenadas. Probá con otra.");
        return;
      }
      const coords = { lat: detalle.lat, lon: detalle.lng };
      setDireccion(detalle.formattedAddress ?? sug.texto);
      const map = mapRef.current;
      if (map) {
        map.setCenter({ lat: coords.lat, lng: coords.lon });
        map.setZoom(ZOOM_UBICACION);
      }
      onChangeRef.current(coords);
    } catch {
      setErrorBusqueda("No pudimos obtener esa dirección. Probá de nuevo.");
    }
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!sugerenciasAbiertas || sugerencias.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceActivo((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceActivo((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === "Enter" && indiceActivo >= 0) {
      e.preventDefault();
      seleccionarSugerencia(sugerencias[indiceActivo]);
    } else if (e.key === "Escape") {
      cerrarSugerencias();
    }
  }

  if (error) {
    return <p className="text-[15px] text-accent-700">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-[5px]">
      <span className="text-[12px] text-text/70">Ubicación</span>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => sugerencias.length > 0 && setSugerenciasAbiertas(true)}
          onBlur={() => setTimeout(cerrarSugerencias, 150)}
          placeholder="Buscá una dirección..."
          className="flex h-10 w-full rounded-[9px] border border-border bg-white px-3 py-2 text-[15px] text-text placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {sugerenciasAbiertas && sugerencias.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-[9px] border border-black/[.08] bg-white shadow-lg">
            {sugerencias.map((s, i) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => seleccionarSugerencia(s)}
                  className={`block w-full px-3 py-2 text-left text-[14px] ${
                    i === indiceActivo ? "bg-accent/10" : "hover:bg-black/[.03]"
                  }`}
                >
                  {s.texto}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {errorBusqueda && <p className="text-[13px] text-accent-700">{errorBusqueda}</p>}
      <div className="relative">
        <div
          ref={containerRef}
          className="h-[280px] w-full rounded-xl border border-black/[.08]"
        />
        {(cargando || buscandoGeo) && (
          <div className="absolute inset-0 z-[1] grid place-items-center rounded-xl bg-white/70 text-[14px] text-text/70">
            {cargando ? "Cargando mapa..." : "Obteniendo tu ubicación..."}
          </div>
        )}
      </div>
      {value ? (
        <p className="text-[13.5px] text-text/60">
          {direccion ? `${direccion} · ` : ""}
          {value.lat.toFixed(6)}, {value.lon.toFixed(6)}.
          Podés arrastrar el pin o tocar el mapa para corregirla.
        </p>
      ) : (
        <p className="text-[13.5px] text-text/60">
          {sinGeo
            ? "No pudimos obtener tu ubicación automáticamente. Buscá la dirección o tocá el mapa."
            : "Buscá la dirección o tocá el mapa para seleccionar la ubicación de la sucursal."}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck y build del web**

```bash
cd web && npx tsc -b --noEmit && npm run build
```

Esperado: sin errores. Si TypeScript se queja de `crypto.randomUUID()`, confirmar que `web/tsconfig.app.json` tiene `"DOM"` en `lib` (ya lo tiene, ver `web/tsconfig.app.json:6`) — `randomUUID` viene del lib DOM moderno; si igual falla, es porque el `target`/`lib` no incluye `ES2021.String`/`dom` con `Crypto.randomUUID`, en cuyo caso agregar `"lib": [..., "ES2023"]` ya cubre eso (target ya es `es2023`, no debería hacer falta tocar nada).

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MapaUbicacion.tsx
git commit -m "feat(web): buscador de direcciones con Autocomplete New + sesión propia"
```

---

## Task 5: Backend — persistir `direccion` en `sucursales`

**Contexto (agregado tras QA manual de las Tasks 1-3):** el usuario pidió
que, al editar una sucursal, el input de búsqueda de `MapaUbicacion`
muestre la dirección ya guardada — y que, al crear, NO se le pida a
Google una dirección "cercana" por geolocalización si eso implica una
llamada extra a la API (la resolución: sí cuesta, así que no se agrega
para el alta). La forma de resolver esto sin ningún costo extra de
Google es guardar en la base la dirección formateada que ya se resuelve
gratis como parte del flujo de búsqueda existente (Place Details, Task
3) — hoy esa dirección se calcula pero se descarta. La migración
`supabase/migrations/0006_sucursales_direccion.sql` (columna
`sucursales.direccion text`, nullable) ya está escrita, aplicada al
Supabase remoto y commiteada — esta task es solo el wiring de
servidor/tipos para leerla y escribirla.

**Files:**
- Modify: `server/src/lib/sucursales.ts`
- Modify: `server/src/routes/sucursales.ts`
- Modify: `web/src/lib/api.ts`

**Interfaces:**
- Consumes: columna `sucursales.direccion` (ya existe en la base, migración `0006_sucursales_direccion.sql`, ya commiteada — no crear ni tocar esa migración en esta task).
- Produces: `Sucursal.direccion: string | null` en ambos lados (server y `web/src/lib/api.ts`); `CrearSucursalInput.direccion?: string` y `EditarSucursalInput.direccion?: string | null` — consumidos por la Task 7 (`SucursalesPage.tsx`).

- [ ] **Step 1: Reemplazar el contenido de `server/src/lib/sucursales.ts`**

```ts
import { createServiceClient } from "./supabase-service.js";

export interface Sucursal {
  id: string;
  org_id: string;
  nombre: string;
  lat: number | null;
  lon: number | null;
  radio_metros: number;
  direccion: string | null;
  activa: boolean;
  created_at: string;
}

export async function listSucursales(orgId: string): Promise<Sucursal[]> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select("*")
    .eq("org_id", orgId)
    .order("nombre");
  if (error) throw error;
  return data;
}

export async function createSucursal(
  orgId: string,
  input: { nombre: string; lat?: number; lon?: number; radio_metros?: number; direccion?: string | null }
): Promise<Sucursal> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .insert({
      org_id: orgId,
      nombre: input.nombre,
      lat: input.lat ?? null,
      lon: input.lon ?? null,
      radio_metros: input.radio_metros ?? 100,
      direccion: input.direccion ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateSucursal(
  orgId: string,
  id: string,
  patch: {
    nombre?: string;
    lat?: number | null;
    lon?: number | null;
    radio_metros?: number;
    direccion?: string | null;
    activa?: boolean;
  }
): Promise<Sucursal> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .update(patch)
    .eq("org_id", orgId)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getSucursal(orgId: string, id: string): Promise<Sucursal | null> {
  const service = createServiceClient();
  const { data, error } = await service
    .from("sucursales")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 2: Reemplazar el contenido de `server/src/routes/sucursales.ts`**

```ts
import type { FastifyInstance } from "fastify";
import QRCode from "qrcode";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { listSucursales, createSucursal, updateSucursal, getSucursal } from "../lib/sucursales.js";
import { env } from "../env.js";

interface CrearBody {
  nombre?: string;
  lat?: number;
  lon?: number;
  radio_metros?: number;
  direccion?: string | null;
}

interface EditarBody {
  nombre?: string;
  lat?: number | null;
  lon?: number | null;
  radio_metros?: number;
  direccion?: string | null;
  activa?: boolean;
}

interface IdParams {
  id: string;
}

export async function sucursalesRoutes(app: FastifyInstance): Promise<void> {
  app.get("/api/sucursales", { preHandler: [requireAuth, requireOrg] }, async (request) => {
    return listSucursales(request.org!.id);
  });

  app.post<{ Body: CrearBody }>(
    "/api/sucursales",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { nombre, lat, lon, radio_metros, direccion } = request.body ?? {};
      if (!nombre?.trim()) {
        return reply.code(400).send({ error: "El nombre es requerido" });
      }
      const sucursal = await createSucursal(request.org!.id, {
        nombre: nombre.trim(),
        lat,
        lon,
        radio_metros,
        direccion,
      });
      return reply.code(201).send(sucursal);
    }
  );

  app.patch<{ Params: IdParams; Body: EditarBody }>(
    "/api/sucursales/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      const body = request.body ?? {};
      const patch: Parameters<typeof updateSucursal>[2] = {};
      if (typeof body.nombre === "string" && body.nombre.trim()) patch.nombre = body.nombre.trim();
      if (body.lat !== undefined) patch.lat = body.lat;
      if (body.lon !== undefined) patch.lon = body.lon;
      if (body.radio_metros !== undefined) patch.radio_metros = body.radio_metros;
      if (body.direccion !== undefined) patch.direccion = body.direccion;
      if (typeof body.activa === "boolean") patch.activa = body.activa;

      return updateSucursal(request.org!.id, id, patch);
    }
  );

  app.delete<{ Params: IdParams }>(
    "/api/sucursales/:id",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { id } = request.params;
      await updateSucursal(request.org!.id, id, { activa: false });
      return { ok: true };
    }
  );

  app.get<{ Params: IdParams }>(
    "/api/sucursales/:id/qr",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const { id } = request.params;
      const sucursal = await getSucursal(request.org!.id, id);
      if (!sucursal) {
        return reply.code(404).send({ error: "Sucursal no encontrada" });
      }
      const url = `${env.marcarBaseUrl}/marcar/${request.org!.slug}/${sucursal.id}`;
      const png = await QRCode.toBuffer(url, { width: 600, margin: 2 });
      reply.header("Content-Type", "image/png");
      reply.header("Content-Disposition", `inline; filename="qr-${sucursal.nombre}.png"`);
      return reply.send(png);
    }
  );
}
```

- [ ] **Step 3: Editar `web/src/lib/api.ts` — 3 cambios puntuales**

Cambio 1, en la interfaz `Sucursal` (agregar `direccion` después de `radio_metros`):

```ts
export interface Sucursal {
  id: string;
  org_id: string;
  nombre: string;
  lat: number | null;
  lon: number | null;
  radio_metros: number;
  direccion: string | null;
  activa: boolean;
  created_at: string;
}
```

Cambio 2, en `CrearSucursalInput` (agregar `direccion?: string;` al final):

```ts
export interface CrearSucursalInput {
  nombre: string;
  lat?: number;
  lon?: number;
  radio_metros?: number;
  direccion?: string;
}
```

Cambio 3, en `EditarSucursalInput` (agregar `direccion?: string | null;` antes de `activa`):

```ts
export interface EditarSucursalInput {
  nombre?: string;
  lat?: number | null;
  lon?: number | null;
  radio_metros?: number;
  direccion?: string | null;
  activa?: boolean;
}
```

No tocar nada más de ese archivo (`getPlaceDetails`/`PlaceDetails` de la Task 2 quedan intactos).

- [ ] **Step 4: Typecheck y build de server y web**

```bash
cd server && npm run build
```
```bash
cd web && npx tsc -b --noEmit
```

Esperado: sin errores en ninguno de los dos.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/sucursales.ts server/src/routes/sucursales.ts web/src/lib/api.ts
git commit -m "feat: persistir direccion en sucursales (server + tipos web)"
```

---

## Task 6: `MapaUbicacion.tsx` — devolver la dirección resuelta, precargar el input al editar, quitar el texto debajo del mapa

**Contexto:** dos pedidos del usuario tras la QA manual: (1) que el
input de búsqueda de este componente muestre la dirección ya elegida —
al seleccionar una sugerencia ya lo hace (`setQuery(sug.texto)`, sin
cambios), pero además debe **precargarse con la dirección guardada al
abrir en modo edición**; y (2) **quitar por completo el párrafo de texto
que hoy aparece debajo del mapa** (dirección + coordenadas + instrucción
de arrastrar el pin, o el mensaje "Buscá la dirección..."/"No pudimos
obtener tu ubicación..."). Para que el padre (`SucursalesPage.tsx`,
Task 7) pueda guardar la dirección elegida en la base (columna nueva de
la Task 5), `onChange` ahora también manda la dirección resuelta (o
`null` cuando el punto se eligió por click/drag/geolocalización, sin
pasar por Places).

**Files:**
- Modify: `web/src/components/MapaUbicacion.tsx`

**Interfaces:**
- Consumes: sin cambios respecto a la Task 3 (`getPlaceDetails`, `@googlemaps/js-api-loader`).
- Produces: **cambia la firma pública** — `onChange: (coords: Coordenadas, direccion: string | null) => void` (antes solo recibía `coords`) y se agrega el prop `direccionInicial?: string | null`. Ambos cambios los consume la Task 7 al actualizar los dos usos de `<MapaUbicacion>` en `SucursalesPage.tsx`.

- [ ] **Step 1: Reemplazar el contenido completo de `web/src/components/MapaUbicacion.tsx`**

```tsx
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { setOptions, importLibrary } from "@googlemaps/js-api-loader";
import { getPlaceDetails } from "../lib/api";

export interface Coordenadas {
  lat: number;
  lon: number;
}

interface MapaUbicacionProps {
  /** Ubicación seleccionada, o null si todavía no se eligió ninguna. */
  value: Coordenadas | null;
  onChange: (coords: Coordenadas, direccion: string | null) => void;
  /** Radio de cobertura en metros: se dibuja como círculo alrededor del pin. */
  radioMetros?: number;
  /** Dirección ya guardada (edición): precarga el input de búsqueda. */
  direccionInicial?: string | null;
}

// Centro por defecto cuando no hay geolocalización disponible (Buenos Aires).
const DEFAULT_CENTER: Coordenadas = { lat: -34.6037, lon: -58.3816 };
const DEFAULT_ZOOM = 12;
const ZOOM_UBICACION = 16;
const DEBOUNCE_MS = 300;

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Carga única del script de Google Maps para toda la app. Solo la librería
// "maps" (Map/Marker/Circle) — el buscador de direcciones no usa el SDK de
// Places, llama directo por fetch al endpoint REST (ver fetchSugerencias).
let googleMapsPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (!googleMapsPromise) {
    setOptions({ key: API_KEY ?? "", v: "weekly", language: "es" });
    googleMapsPromise = importLibrary("maps").then(() => undefined);
  }
  return googleMapsPromise;
}

interface Sugerencia {
  placeId: string;
  texto: string;
}

interface AutocompleteSuggestionsResponse {
  suggestions?: Array<{
    placePrediction?: { placeId: string; text: { text: string } };
  }>;
}

// Autocomplete (New) por REST directo, con la key del frontend (restringida
// por HTTP referrer) y un session token propio — ver spec §2.
async function fetchSugerencias(
  input: string,
  sessionToken: string,
  signal: AbortSignal
): Promise<Sugerencia[]> {
  const res = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": API_KEY ?? "" },
    body: JSON.stringify({
      input,
      sessionToken,
      includedRegionCodes: ["ar"],
      languageCode: "es",
    }),
  });
  if (!res.ok) throw new Error("Falló places:autocomplete");
  const data = (await res.json()) as AutocompleteSuggestionsResponse;
  const sugerencias: Sugerencia[] = [];
  for (const s of data.suggestions ?? []) {
    if (s.placePrediction) {
      sugerencias.push({ placeId: s.placePrediction.placeId, texto: s.placePrediction.text.text });
    }
  }
  return sugerencias;
}

/**
 * Selector de ubicación con Google Maps. Si no hay valor inicial intenta usar
 * la geolocalización del navegador; si falla, muestra un centro por defecto y
 * deja elegir el punto manualmente (buscador de direcciones, click en el mapa
 * o arrastrando el pin).
 */
export function MapaUbicacion({ value, onChange, radioMetros, direccionInicial }: MapaUbicacionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const circleRef = useRef<google.maps.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [cargando, setCargando] = useState(true);
  const [buscandoGeo, setBuscandoGeo] = useState(value == null);
  const [error, setError] = useState<string | null>(null);

  // Buscador de direcciones. Si es edición (value ya viene con datos),
  // arranca precargado con la dirección guardada.
  const [query, setQuery] = useState(direccionInicial ?? "");
  const [sugerencias, setSugerencias] = useState<Sugerencia[]>([]);
  const [sugerenciasAbiertas, setSugerenciasAbiertas] = useState(false);
  const [indiceActivo, setIndiceActivo] = useState(-1);
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null);
  const sessionTokenRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!API_KEY) {
      setError("Falta configurar la API key de Google Maps (VITE_GOOGLE_MAPS_API_KEY).");
      setCargando(false);
      setBuscandoGeo(false);
      return;
    }
    if (mapRef.current) return;

    let cancelado = false;
    (async () => {
      try {
        await loadGoogleMaps();
      } catch {
        if (!cancelado) {
          setError("No se pudo cargar Google Maps. Revisá la API key y tu conexión.");
          setCargando(false);
          setBuscandoGeo(false);
        }
        return;
      }
      if (cancelado || !containerRef.current) return;

      const inicial = value ?? DEFAULT_CENTER;
      const map = new google.maps.Map(containerRef.current, {
        center: { lat: inicial.lat, lng: inicial.lon },
        zoom: value ? ZOOM_UBICACION : DEFAULT_ZOOM,
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: false,
        clickableIcons: false,
      });
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        onChangeRef.current({ lat: e.latLng.lat(), lon: e.latLng.lng() }, null);
      });
      mapRef.current = map;
      setCargando(false);

      // Sin valor inicial (alta): intentamos centrar en la ubicación actual.
      // Con valor inicial (edición): se respeta lo guardado, sin pedir geo.
      if (value == null) {
        if (!navigator.geolocation) {
          setBuscandoGeo(false);
        } else {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              setBuscandoGeo(false);
              // Si el usuario ya eligió un punto manualmente, no lo pisamos.
              if (markerRef.current) return;
              const coords = { lat: pos.coords.latitude, lon: pos.coords.longitude };
              map.setCenter({ lat: coords.lat, lng: coords.lon });
              map.setZoom(ZOOM_UBICACION);
              onChangeRef.current(coords, null);
            },
            () => {
              setBuscandoGeo(false);
            },
            { timeout: 8000, maximumAge: 60000 }
          );
        }
      }
    })();

    return () => {
      cancelado = true;
    };
    // El mapa se inicializa una sola vez con el valor de apertura.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sincroniza el pin y el círculo con el valor seleccionado (sin recentrar).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (value == null) {
      markerRef.current?.setMap(null);
      markerRef.current = null;
      circleRef.current?.setMap(null);
      circleRef.current = null;
      return;
    }
    const pos = { lat: value.lat, lng: value.lon };
    if (markerRef.current) {
      markerRef.current.setPosition(pos);
    } else {
      const marker = new google.maps.Marker({ map, position: pos, draggable: true });
      marker.addListener("dragend", () => {
        const p = marker.getPosition();
        if (!p) return;
        onChangeRef.current({ lat: p.lat(), lon: p.lng() }, null);
      });
      markerRef.current = marker;
    }
    if (circleRef.current) {
      circleRef.current.setCenter(pos);
    } else {
      circleRef.current = new google.maps.Circle({
        map,
        center: pos,
        strokeColor: "#2563eb",
        strokeWeight: 1.5,
        strokeOpacity: 0.7,
        fillColor: "#2563eb",
        fillOpacity: 0.12,
        clickable: false,
      });
    }
  }, [value, cargando]);

  // Actualiza el radio del círculo sin tocar nada más.
  useEffect(() => {
    circleRef.current?.setRadius(radioMetros && radioMetros > 0 ? radioMetros : 100);
  }, [radioMetros, value, cargando]);

  // Limpieza del debounce/fetch pendiente al desmontar.
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  function cerrarSugerencias() {
    setSugerenciasAbiertas(false);
    setIndiceActivo(-1);
  }

  function handleQueryChange(texto: string) {
    setQuery(texto);
    setErrorBusqueda(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();

    if (texto.trim() === "") {
      sessionTokenRef.current = null;
      setSugerencias([]);
      cerrarSugerencias();
      return;
    }
    // Primer caracter de una búsqueda nueva: token de sesión nuevo.
    if (!sessionTokenRef.current) {
      sessionTokenRef.current = crypto.randomUUID();
    }
    const token = sessionTokenRef.current;
    debounceRef.current = setTimeout(() => {
      const controller = new AbortController();
      abortRef.current = controller;
      fetchSugerencias(texto, token, controller.signal)
        .then((resultados) => {
          if (controller.signal.aborted) return;
          setSugerencias(resultados);
          setSugerenciasAbiertas(true);
          setIndiceActivo(-1);
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setErrorBusqueda("No pudimos buscar sugerencias. Probá de nuevo.");
          setSugerencias([]);
        });
    }, DEBOUNCE_MS);
  }

  async function seleccionarSugerencia(sug: Sugerencia) {
    const token = sessionTokenRef.current;
    cerrarSugerencias();
    setQuery(sug.texto);
    setErrorBusqueda(null);
    if (!token) return;
    try {
      const detalle = await getPlaceDetails(sug.placeId, token);
      // Sesión concluida: la próxima búsqueda arranca con un token nuevo.
      sessionTokenRef.current = null;
      if (detalle.lat == null || detalle.lng == null) {
        setErrorBusqueda("Esa dirección no tiene coordenadas. Probá con otra.");
        return;
      }
      const coords = { lat: detalle.lat, lon: detalle.lng };
      const direccion = detalle.formattedAddress ?? sug.texto;
      const map = mapRef.current;
      if (map) {
        map.setCenter({ lat: coords.lat, lng: coords.lon });
        map.setZoom(ZOOM_UBICACION);
      }
      onChangeRef.current(coords, direccion);
    } catch {
      setErrorBusqueda("No pudimos obtener esa dirección. Probá de nuevo.");
    }
  }

  function handleInputKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!sugerenciasAbiertas || sugerencias.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceActivo((i) => (i + 1) % sugerencias.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceActivo((i) => (i <= 0 ? sugerencias.length - 1 : i - 1));
    } else if (e.key === "Enter" && indiceActivo >= 0) {
      e.preventDefault();
      seleccionarSugerencia(sugerencias[indiceActivo]);
    } else if (e.key === "Escape") {
      cerrarSugerencias();
    }
  }

  if (error) {
    return <p className="text-[15px] text-accent-700">{error}</p>;
  }

  return (
    <div className="flex flex-col gap-[5px]">
      <span className="text-[12px] text-text/70">Ubicación</span>
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          onKeyDown={handleInputKeyDown}
          onFocus={() => sugerencias.length > 0 && setSugerenciasAbiertas(true)}
          onBlur={() => setTimeout(cerrarSugerencias, 150)}
          placeholder="Buscá una dirección..."
          className="flex h-10 w-full rounded-[9px] border border-border bg-white px-3 py-2 text-[15px] text-text placeholder:text-text-tertiary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        {sugerenciasAbiertas && sugerencias.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-[9px] border border-black/[.08] bg-white shadow-lg">
            {sugerencias.map((s, i) => (
              <li key={s.placeId}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => seleccionarSugerencia(s)}
                  className={`block w-full px-3 py-2 text-left text-[14px] ${
                    i === indiceActivo ? "bg-accent/10" : "hover:bg-black/[.03]"
                  }`}
                >
                  {s.texto}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {errorBusqueda && <p className="text-[13px] text-accent-700">{errorBusqueda}</p>}
      <div className="relative">
        <div
          ref={containerRef}
          className="h-[280px] w-full rounded-xl border border-black/[.08]"
        />
        {(cargando || buscandoGeo) && (
          <div className="absolute inset-0 z-[1] grid place-items-center rounded-xl bg-white/70 text-[14px] text-text/70">
            {cargando ? "Cargando mapa..." : "Obteniendo tu ubicación..."}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck** (el build todavía va a fallar hasta la Task 7, que actualiza `SucursalesPage.tsx` para la nueva firma de `onChange` — alcanza con `tsc` sobre este archivo solo, no hace falta `npm run build` completo todavía)

```bash
cd web && npx tsc -b --noEmit
```

Esperado: **puede** marcar error en `web/src/pages/sucursales/SucursalesPage.tsx` (todavía no actualizado — eso lo resuelve la Task 7). Si el único error reportado es ahí (por la firma de `onChange`/falta de `direccion` en los tipos), está bien seguir. Cualquier error DENTRO de `MapaUbicacion.tsx` sí hay que resolverlo antes de continuar.

- [ ] **Step 3: Commit**

```bash
git add web/src/components/MapaUbicacion.tsx
git commit -m "feat(web): MapaUbicacion devuelve la direccion resuelta, precarga el input al editar, quita el texto debajo del mapa"
```

---

## Task 7: `SucursalesPage.tsx` — wiring de `direccion` en alta/edición

**Files:**
- Modify: `web/src/pages/sucursales/SucursalesPage.tsx`

**Interfaces:**
- Consumes: `Sucursal.direccion`, `CrearSucursalInput.direccion`, `EditarSucursalInput.direccion` (Task 5); `MapaUbicacion`'s nueva firma `onChange: (coords, direccion) => void` y prop `direccionInicial` (Task 6).
- Produces: nada nuevo para otras tasks — es la última pieza de código de esta feature.

- [ ] **Step 1: Agregar los dos estados de dirección**

Después de la línea `const [coords, setCoords] = useState<Coordenadas | null>(null);`, agregar:

```tsx
  const [direccion, setDireccion] = useState<string | null>(null);
```

Después de la línea `const [editCoords, setEditCoords] = useState<Coordenadas | null>(null);`, agregar:

```tsx
  const [editDireccion, setEditDireccion] = useState<string | null>(null);
```

- [ ] **Step 2: Resetear en `resetAlta`**

```tsx
  function resetAlta() {
    setNombre("");
    setRadio("100");
    setCoords(null);
    setDireccion(null);
  }
```

- [ ] **Step 3: Mandar `direccion` en `handleAlta`**

```tsx
      await crear.mutateAsync({
        nombre,
        lat: coords?.lat,
        lon: coords?.lon,
        radio_metros: parseNumero(radio),
        direccion: direccion ?? undefined,
      });
```

- [ ] **Step 4: Precargar `editDireccion` en `abrirEdicion`**

```tsx
  function abrirEdicion(suc: Sucursal) {
    setError(null);
    setEditando(suc);
    setEditNombre(suc.nombre);
    setEditRadio(suc.radio_metros.toString());
    setEditCoords(coordsDe(suc));
    setEditDireccion(suc.direccion);
  }
```

- [ ] **Step 5: Mandar `direccion` en `handleGuardarEdicion`**

```tsx
      await editar.mutateAsync({
        id: editando.id,
        patch: {
          nombre: editNombre,
          lat: editCoords?.lat ?? null,
          lon: editCoords?.lon ?? null,
          radio_metros: parseNumero(editRadio),
          direccion: editDireccion,
        },
      });
```

- [ ] **Step 6: Actualizar el `<MapaUbicacion>` del alta**

Reemplazar:

```tsx
          <MapaUbicacion value={coords} onChange={setCoords} radioMetros={parseNumero(radio)} />
```

por:

```tsx
          <MapaUbicacion
            value={coords}
            onChange={(c, d) => {
              setCoords(c);
              setDireccion(d);
            }}
            radioMetros={parseNumero(radio)}
          />
```

- [ ] **Step 7: Actualizar el `<MapaUbicacion>` de la edición**

Reemplazar:

```tsx
          <MapaUbicacion value={editCoords} onChange={setEditCoords} radioMetros={parseNumero(editRadio)} />
```

por:

```tsx
          <MapaUbicacion
            value={editCoords}
            onChange={(c, d) => {
              setEditCoords(c);
              setEditDireccion(d);
            }}
            radioMetros={parseNumero(editRadio)}
            direccionInicial={editando?.direccion ?? null}
          />
```

- [ ] **Step 8: Typecheck y build completos**

```bash
cd web && npx tsc -b --noEmit && npm run build
```

Esperado: sin errores (ahora sí tiene que compilar limpio de punta a punta, incluyendo lo que la Task 6 dejó pendiente).

- [ ] **Step 9: Commit**

```bash
git add web/src/pages/sucursales/SucursalesPage.tsx
git commit -m "feat(web): wiring de direccion en alta/edicion de sucursales"
```

---

## Task 8: Verificación E2E

**Files:** ninguno — es la tarea de cierre, sin cambios de código.

**Interfaces:** ninguna.

- [x] **Step 1: Cargar API keys reales** — ya hecho: `VITE_GOOGLE_MAPS_API_KEY`
  en `web/.env.local` y `GOOGLE_MAPS_API_KEY` en `server/.env.local`.

- [x] **Step 2: Levantar server y web** — ya corriendo (server `:3020`, web
  `:5180`).

- [ ] **Step 3: Checklist manual (para el usuario en el navegador)**

1. Entrar a Sucursales, abrir "Nueva sucursal" — confirmar que el mapa
   carga y (si el navegador da permiso) centra en la ubicación actual.
2. Tipear una dirección real (ej. "Av. Corrientes 1000, Buenos Aires") en
   el buscador — confirmar que aparecen sugerencias después de ~300ms sin
   trabar el tipeo, y que se puede navegar la lista con flechas ↑/↓ y
   Enter, además de con el mouse.
3. Seleccionar una sugerencia — confirmar que el mapa recentra y aparece
   el pin. El input de búsqueda debe quedar mostrando el texto de la
   dirección elegida (ya no hay texto aparte debajo del mapa — se quitó).
4. Abrir la pestaña Network del navegador durante el paso 2 y 3:
   confirmar que la llamada de sugerencias va a
   `places.googleapis.com/v1/places:autocomplete` (key del frontend) y
   que al seleccionar, la llamada de detalle va a
   `localhost:3020/api/places/details` (no directo a Google) — es el
   backend el que hace la llamada final a Google con su propia key.
5. Borrar el texto del buscador y volver a tipear otra dirección —
   confirmar que sigue funcionando (token de sesión nuevo).
6. Arrastrar el pin o tocar el mapa directamente — confirmar que sigue
   funcionando como antes (sin pasar por Places, coordenadas directas).
   Confirmar también que ya no queda ningún texto/tooltip debajo del
   mapa (se quitó por completo, en cualquier estado del componente).
7. Guardar la sucursal creada en el paso 3 (buscada por dirección) — con
   Network abierto, confirmar que el `POST /api/sucursales` manda
   `direccion` con el texto elegido, y que la fila nueva aparece en la
   tabla.
8. Editar esa misma sucursal (la del paso 7) — confirmar que el mapa
   abre centrado en su ubicación guardada, **con el pin y el círculo
   visibles de entrada** (bug ya arreglado, confirmar que sigue así) y
   con el input de búsqueda **precargado con la dirección guardada**
   (sin tipear nada). Buscar/seleccionar una dirección nueva debe
   reemplazar tanto el pin como el texto del input, igual que en el
   alta.
9. Editar una sucursal que fue ubicada históricamente por click/drag en
   el mapa (sin búsqueda, `direccion` null en la base) — confirmar que
   el input de búsqueda arranca vacío (no hay dirección guardada para
   mostrar) pero el pin/círculo sí aparecen igual, en su posición
   guardada.
10. Crear una sucursal nueva (alta) — confirmar que el input de
    búsqueda arranca vacío (no se precarga con la dirección "cercana"
    de la geolocalización automática — decisión explícita para no sumar
    una llamada extra a la API).
11. Probar un error intencional (ej. cortar el WiFi un instante mientras
    se buscan sugerencias) — confirmar que aparece el mensaje de error
    corto bajo el input y el formulario sigue usable.

Esperar la confirmación explícita del usuario antes de dar la tarea por
cerrada.
