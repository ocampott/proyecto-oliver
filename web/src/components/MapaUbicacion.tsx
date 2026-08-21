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
