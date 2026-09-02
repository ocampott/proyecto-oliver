import { useEffect, useState, type ReactNode } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowRight, CheckCircle, Loader2, LogIn, LogOut, RotateCcw, TriangleAlert } from "lucide-react";
import { Button } from "../components/ui/button";
import { Field } from "../components/ui/field";
import { Card } from "../components/ui/card";
import { cn } from "../lib/utils";
import { getEstadoMarcado, identificar, verificar, registrarMarca } from "../lib/api";

type Etapa =
  | { tipo: "cargando" }
  | { tipo: "invalido" }
  | { tipo: "identificar" }
  | { tipo: "confirmar"; sugerencia: string }
  | { tipo: "codigo"; empleadoId: string }
  | { tipo: "marcar"; nombre: string }
  | { tipo: "rechazado"; nombreMarcar: string; mensaje: string };

function IconCircle({
  tone,
  size,
  icon,
}: {
  tone: "success" | "alert";
  /** Lado del círculo en px. 52 = ícono principal de estado; 26 = adorno inline. */
  size: 26 | 52;
  icon: ReactNode;
}) {
  return (
    <span
      className={cn(
        "flex flex-none items-center justify-center rounded-full",
        tone === "alert" ? "bg-alert-100" : "bg-success-700"
      )}
      style={{ height: size, width: size }}
    >
      {icon}
    </span>
  );
}

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
          setMensaje(`${label} registrada a las ${horaLocal(body.hora)}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : "Algo salió mal. Probá de nuevo.";
          if (etapa.tipo === "marcar") {
            setEtapa({ tipo: "rechazado", nombreMarcar: etapa.nombre, mensaje: msg });
          } else {
            setError(msg);
          }
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
      <main className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-8">
        <Card className="w-full max-w-sm text-center">
          <Loader2
            className="mx-auto h-6 w-6 animate-spin text-text-tertiary"
            role="status"
            aria-label="Cargando"
          />
        </Card>
      </main>
    );
  }

  if (etapa.tipo === "invalido") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-8">
        <Card className="w-full max-w-sm text-center">
          <p className="text-text">
            Este enlace no es válido o la sucursal está desactivada. Pedile el QR correcto a tu encargado.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-8">
      <Card className="w-full max-w-sm">
        <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-text">{sucursalNombre}</h1>

        {etapa.tipo === "identificar" && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleIdentificar(nombre);
            }}
            className="mt-4 space-y-4"
          >
            <Field
              label="Escribí tu nombre y apellido como figura en la nómina."
              required
              placeholder="Tu nombre y apellido"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
            />
            <Button type="submit" variant="primary" size="lg" className="h-12 justify-between text-[15px]" disabled={loading}>
              Continuar <ArrowRight className="h-4 w-4" />
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
            <Field
              label="Pedile el código de vinculación a tu encargado e ingresalo acá. Se hace una sola vez en este dispositivo."
              required
              inputMode="numeric"
              placeholder="Código de 6 dígitos"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\s/g, ""))}
              className="text-center text-lg tracking-widest"
            />
            <Button type="submit" variant="primary" size="lg" className="h-12 text-[15px]" disabled={loading}>
              Vincular
            </Button>
          </form>
        )}

        {etapa.tipo === "marcar" && (
          <div className="mt-4 space-y-4">
            <p className="text-text">
              Hola, <strong>{etapa.nombre}</strong>
            </p>
            <Button
              onClick={() => handleMarcar("entrada")}
              variant="primary"
              size="lg"
              className="h-12 text-[15px]"
              disabled={loading}
            >
              <LogIn className="h-4 w-4" /> Marcar entrada
            </Button>
            <Button
              onClick={() => handleMarcar("salida")}
              variant="secondary"
              size="lg"
              className="h-12 text-[15px]"
              disabled={loading}
            >
              <LogOut className="h-4 w-4" /> Marcar salida
            </Button>
            {org && (
              <Link to={`/chat/${org}`} className="block text-center text-[13.5px] text-text-secondary underline hover:text-text">
                Hablar con RRHH →
              </Link>
            )}
          </div>
        )}

        {etapa.tipo === "rechazado" && (
          <div className="mt-4 flex flex-col gap-3">
            <IconCircle tone="alert" size={52} icon={<TriangleAlert className="h-[26px] w-[26px] text-alert" />} />
            <h4 className="text-[20px] font-semibold tracking-[-0.02em] text-text">No pudimos registrar la marca</h4>
            <p className="text-[13px] text-text-secondary">{etapa.mensaje}</p>
            <Button
              variant="secondary"
              block
              onClick={() => setEtapa({ tipo: "marcar", nombre: etapa.nombreMarcar })}
            >
              <RotateCcw className="h-4 w-4" /> Volver a intentar
            </Button>
          </div>
        )}

        {mensaje && (
          <div className="mt-4 flex items-center gap-[10px] rounded-[10px] bg-success-100 px-[14px] py-[13px] text-[13.5px] font-semibold text-success-700">
            <IconCircle tone="success" size={26} icon={<CheckCircle className="h-3.5 w-3.5 text-white" />} />
            {mensaje}
          </div>
        )}
        {error && <p className="mt-4 text-[15px] text-alert">{error}</p>}
      </Card>
    </main>
  );
}
