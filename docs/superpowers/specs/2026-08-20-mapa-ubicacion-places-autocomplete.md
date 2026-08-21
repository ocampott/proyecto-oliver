# Buscador de dirección en el mapa de ubicación (Places API New)

Fecha: 2026-08-20
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

En la rama `feat/sucursales-mapa-ubicacion` ya existe un selector de
ubicación (`web/src/components/MapaUbicacion.tsx`, integrado en
`SucursalesPage.tsx` para alta y edición) con mapa de Google, pin
arrastrable y click para elegir el punto. El buscador de direcciones
usaba `google.maps.places.PlaceAutocompleteElement` (widget del SDK JS
de Google), que resuelve la dirección elegida enteramente del lado del
navegador con `place.fetchFields()` — usando la key pública del
frontend también para el paso de Place Details.

Esta spec reemplaza ese buscador por una implementación optimizada para
costo: el **Autocomplete** (sugerencias mientras el usuario tipea) sigue
corriendo en el navegador, pero la resolución final de la dirección
elegida (**Place Details**, la llamada más cara) se mueve al backend,
con una API key de servidor separada y restringida por IP — la key del
frontend nunca queda con permisos de Details.

Contexto de volumen: app nueva, uso muy bajo. Prioridad: mantenerse
dentro de la capa gratuita de Google (Essentials: 10.000 llamadas/mes).

## 2. Arquitectura

- **Frontend** (`MapaUbicacion.tsx`, Vite + React): input de texto con
  sugerencias. Llama directo por `fetch` al endpoint REST de Google
  **Autocomplete (New)** (`POST https://places.googleapis.com/v1/places:autocomplete`)
  con la key del frontend (`VITE_GOOGLE_MAPS_API_KEY`, restringida por
  HTTP referrer en Google Cloud Console). No usa el SDK JS de Places
  para esto — la llamada REST directa evita cargar la librería `places`
  del SDK y deja el manejo del session token 100% en nuestro código.
- **Backend** (`server/src/routes/places.ts`, ya existe, ver §4): recibe
  `{ placeId, sessionToken }` desde el frontend y llama a **Place
  Details (New)** (`GET https://places.googleapis.com/v1/places/{placeId}`)
  con la key de servidor (`GOOGLE_MAPS_API_KEY`, restringida por IP),
  pidiendo solo los 3 campos necesarios vía field mask.
- **Session token**: se genera en el frontend como un string propio
  (`crypto.randomUUID()`), **no** el objeto opaco
  `google.maps.places.AutocompleteSessionToken` del SDK JS (ese objeto
  solo sirve para uso interno del SDK — no se puede extraer como string
  para reenviar a nuestro propio backend). El mismo string UUID viaja en
  cada llamada de Autocomplete y en la llamada final de Details, para
  que Google facture las dos etapas como una sola sesión.

## 3. Requisitos funcionales

1. **Places API New**, no la Legacy (`AutocompleteService`/
   `PlacesService`, deprecadas).
2. **Session tokens**:
   - Se genera un token nuevo (`crypto.randomUUID()`) la primera vez que
     el input pasa de vacío a tener contenido.
   - Se reutiliza el mismo token en todas las llamadas de Autocomplete
     de esa búsqueda (mientras el usuario sigue tipeando).
   - Se envía ese mismo token junto con el `placeId` al backend al
     seleccionar una sugerencia.
   - Se descarta (vuelve a `null`) después de una selección exitosa o
     si el usuario borra el input a vacío — la próxima búsqueda genera
     un token nuevo.
3. **Place Details** (backend) pide únicamente `formattedAddress`,
   `location`, `addressComponents` (field mask SKU Essentials) — nada
   de `photos`, `rating`, `opening_hours` ni otros campos Pro/Enterprise.
4. **Debounce de ~300ms** en el input antes de disparar Autocomplete.
5. **Restricción geográfica a Argentina** vía `includedRegionCodes: ["ar"]`
   en la request de Autocomplete (New) — es el equivalente del
   `componentRestrictions` legacy para este endpoint.
6. **Manejo de errores amigable**: si Autocomplete falla, mensaje corto
   bajo el input sin romper el resto del formulario ni tocar el valor ya
   seleccionado; si no hay resultados, la lista de sugerencias
   simplemente no se muestra; si falla el Place Details al seleccionar,
   mensaje de error sin perder lo tipeado.
7. **Endpoint backend**: `POST /api/places/details`, body
   `{ placeId, sessionToken }`, responde
   `{ formattedAddress, lat, lng, addressComponents }`.

## 4. Estado actual del código (qué ya está y qué falta)

- `server/src/routes/places.ts` **ya implementa exactamente el punto 7**
  (incluida la validación de `sessionToken` como UUID y el field mask
  del punto 3) — no necesita cambios de lógica, pero está importado en
  `server/src/index.ts` y **nunca registrado** (`app.register` faltante).
- `web/.env.example` y `server/.env.example` ya tienen
  `VITE_GOOGLE_MAPS_API_KEY` y `GOOGLE_MAPS_API_KEY` documentadas
  (nombres existentes, cumplen el mismo objetivo que
  `GOOGLE_MAPS_API_KEY_FRONTEND`/`_BACKEND` mencionados informalmente:
  una key por lado, la del frontend con prefijo `VITE_`). Se mantienen
  esos nombres para no generar más churn — no se renombran.
- `MapaUbicacion.tsx` usa hoy `PlaceAutocompleteElement` +
  `place.fetchFields()` (100% client-side, sin session token propio,
  sin backend) — se reemplaza por el flujo descripto en §2.
- Ninguna de las dos `.env.local` (raíz de `server/`/`web/`) tiene keys
  reales todavía — hace falta que el usuario las cargue para poder
  probar en el navegador (Google Cloud Console: una key para "Maps
  JavaScript API" + "Places API (New)" restringida por HTTP referrer del
  dominio de la app, otra para "Places API (New)" restringida por IP del
  servidor).

## 5. Fuera de alcance

- Geocoding reverso al hacer click en el mapa o arrastrar el pin (sigue
  usando directamente las coordenadas del evento del mapa, sin llamar a
  Places — no genera costo adicional, no se toca).
- Cualquier cambio visual/estructural de `SucursalesPage.tsx` más allá
  de lo ya integrado — este spec es solo el buscador de direcciones.
