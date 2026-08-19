import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Card } from "../components/ui/card";
import { getEstadoMarcado, identificar, verificar, registrarMarca } from "../lib/api";

type Etapa =
  | { tipo: "cargando" }
  | { tipo: "invalido" }
  | { tipo: "identificar" }
  | { tipo: "confirmar"; sugerencia: string }
  | { tipo: "codigo"; empleadoId: string }
  | { tipo: "marcar"; nombre: string };

function horaLocal(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
}

export default function MarcarPage() {
  const { org, sucursal } = useParams<{ org: string; sucursal: string }>();
  const [sucursalNombre, setSucursalNombre] = useState("");
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "cargando" });
  const [nombre, setNombre] = useState("");
  const [code, setCode] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!org || !sucursal) return;
    getEstadoMarcado(org, sucursal)
      .then((estado) => {
        setSucursalNombre(estado.sucursalNombre);
        setEtapa(
          estado.empleadoNombre
            ? { tipo: "marcar", nombre: estado.empleadoNombre }
            : { tipo: "identificar" }
        );
      })
      .catch(() => setEtapa({ tipo: "invalido" }));
  }, [org, sucursal]);

  async function handleIdentificar(nombreAUsar: string) {
    if (!org || !sucursal) return;
    setLoading(true);
    setError(null);
    try {
      const body = await identificar(org, sucursal, nombreAUsar);
      if (body.sugerencia) {
        setEtapa({ tipo: "confirmar", sugerencia: body.sugerencia });
      } else if (body.empleadoId) {
        setEtapa({ tipo: "codigo", empleadoId: body.empleadoId });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerificar(empleadoId: string) {
    setLoading(true);
    setError(null);
    try {
      const body = await verificar(empleadoId, code);
      setEtapa({ tipo: "marcar", nombre: body.nombre });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  function handleMarcar(tipo: "entrada" | "salida") {
    if (!sucursal) return;
    setLoading(true);
    setError(null);
    setMensaje(null);

    if (!navigator.geolocation) {
      setError("Este navegador no soporta geolocalización. Probá con Chrome o Safari.");
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const body = await registrarMarca(sucursal, tipo, pos.coords.latitude, pos.coords.longitude);
          const label = body.tipo === "entrada" ? "Entrada" : "Salida";
          setMensaje(`${label} registrada a las ${horaLocal(body.hora)} ✔`);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.");
        } finally {
          setLoading(false);
        }
      },
      () => {
        setError(
          "Necesitamos tu ubicación para registrar la marca. Habilitá la geolocalización en el navegador y probá de nuevo."
        );
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  if (etapa.tipo === "cargando") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8">
        <p className="text-text/60">Cargando...</p>
      </main>
    );
  }

  if (etapa.tipo === "invalido") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8">
        <p className="max-w-sm text-center text-text">
          Este enlace no es válido o la sucursal está desactivada. Pedile el QR correcto a tu encargado.
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-8">
      <Card className="w-full max-w-sm">
        <h1 className="text-[20px] font-extrabold text-text">{sucursalNombre}</h1>

        {etapa.tipo === "identificar" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleIdentificar(nombre);
            }}
            className="mt-4 space-y-4"
          >
            <p className="text-[15px] text-text/60">
              Escribí tu nombre y apellido como figura en la nómina.
            </p>
            <Input
              required
              placeholder="Tu nombre y apellido"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Button type="submit" variant="primary" size="lg" disabled={loading}>
              Continuar
            </Button>
          </form>
        )}

        {etapa.tipo === "confirmar" && (
          <div className="mt-4 space-y-4">
            <p className="text-text">
              ¿Sos <strong>{etapa.sugerencia}</strong>?
            </p>
            <div className="flex gap-2">
              <Button
                onClick={() => handleIdentificar(etapa.sugerencia)}
                variant="primary"
                disabled={loading}
                className="flex-1"
              >
                Sí, soy yo
              </Button>
              <Button
                onClick={() => setEtapa({ tipo: "identificar" })}
                variant="secondary"
                className="flex-1"
              >
                No
              </Button>
            </div>
          </div>
        )}

        {etapa.tipo === "codigo" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleVerificar(etapa.empleadoId);
            }}
            className="mt-4 space-y-4"
          >
            <p className="text-[15px] text-text/60">
              Pedile el código de vinculación a tu encargado e ingresalo acá. Se hace una sola vez en
              este dispositivo.
            </p>
            <Input
              required
              inputMode="numeric"
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center text-lg tracking-widest"
            />
            <Button type="submit" variant="primary" size="lg" disabled={loading}>
              Vincular
            </Button>
          </form>
        )}

        {etapa.tipo === "marcar" && (
          <div className="mt-4 space-y-4">
            <p className="text-text">
              Hola, <strong>{etapa.nombre}</strong>
            </p>
            <Button onClick={() => handleMarcar("entrada")} variant="primary" size="lg" disabled={loading}>
              Marcar entrada
            </Button>
            <Button onClick={() => handleMarcar("salida")} variant="secondary" size="lg" disabled={loading}>
              Marcar salida
            </Button>
          </div>
        )}

        {mensaje && <p className="mt-4 text-[15px] text-green-700">{mensaje}</p>}
        {error && <p className="mt-4 text-[15px] text-accent-700">{error}</p>}
      </Card>
    </main>
  );
}
