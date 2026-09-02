import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, Send, Paperclip } from "lucide-react";
import { Button } from "../components/ui/button";
import { Card } from "../components/ui/card";
import {
  getChatEstado,
  getChatHistorial,
  enviarChatMensaje,
  subirChatCertificado,
  type ChatEntrada,
  type ChatOpcion,
  type ChatRespuesta,
} from "../lib/api";

interface Burbuja {
  remitente: "empleado" | "sistema";
  texto: string;
}

type Etapa = { tipo: "cargando" } | { tipo: "sin_vincular" } | { tipo: "chat"; nombre: string };

export default function ChatEmpleadoPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [etapa, setEtapa] = useState<Etapa>({ tipo: "cargando" });
  const [mensajes, setMensajes] = useState<Burbuja[]>([]);
  const [entrada, setEntrada] = useState<ChatEntrada>("menu");
  const [opciones, setOpciones] = useState<ChatOpcion[] | undefined>(undefined);
  const [texto, setTexto] = useState("");
  const [fecha, setFecha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!orgSlug) return;
    getChatEstado(orgSlug)
      .then((estado) => {
        if (!estado.vinculado) {
          setEtapa({ tipo: "sin_vincular" });
          return;
        }
        setEtapa({ tipo: "chat", nombre: estado.empleadoNombre ?? "" });
        return getChatHistorial().then((h) => {
          setMensajes(h.mensajes.map((m) => ({ remitente: m.remitente, texto: m.texto })));
          setEntrada(h.entrada);
          setOpciones(h.opciones);
        });
      })
      .catch(() => setEtapa({ tipo: "sin_vincular" }));
  }, [orgSlug]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes]);

  function aplicarRespuesta(respuesta: ChatRespuesta) {
    setMensajes((prev) => [...prev, ...respuesta.mensajes.map((texto) => ({ remitente: "sistema" as const, texto }))]);
    setEntrada(respuesta.entrada);
    setOpciones(respuesta.opciones);
  }

  async function enviar(valor: string, mostrarComo: string) {
    if (enviando) return;
    setError(null);
    setEnviando(true);
    setMensajes((prev) => [...prev, { remitente: "empleado", texto: mostrarComo }]);
    try {
      const respuesta = await enviarChatMensaje(valor);
      aplicarRespuesta(respuesta);
      setTexto("");
      setFecha("");
    } catch {
      setError("No se pudo enviar. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  async function subirArchivo(file: File) {
    if (enviando) return;
    setError(null);
    setEnviando(true);
    setMensajes((prev) => [...prev, { remitente: "empleado", texto: `📎 ${file.name}` }]);
    try {
      const respuesta = await subirChatCertificado(file);
      aplicarRespuesta(respuesta);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch {
      setError("No se pudo subir el archivo. Probá de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (etapa.tipo === "cargando") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-8">
        <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" role="status" aria-label="Cargando" />
      </main>
    );
  }

  if (etapa.tipo === "sin_vincular") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-4 sm:p-8">
        <Card className="w-full max-w-sm text-center">
          <h1 className="text-[18px] font-semibold tracking-[-0.02em] text-text">Chat con RRHH</h1>
          <p className="mt-3 text-[14px] text-text-secondary">
            Tu dispositivo todavía no está vinculado. Primero tenés que marcar tu entrada o salida al menos una vez
            desde el QR de tu sucursal — después vas a poder volver a este chat desde el mismo celular.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 border-b border-border bg-surface-raised px-4 py-3.5">
        <h1 className="text-[16px] font-semibold tracking-[-0.02em] text-text">Chat con RRHH</h1>
        <p className="text-[12.5px] text-text-secondary">{etapa.nombre}</p>
      </header>

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-2.5 overflow-y-auto px-4 py-5">
        {mensajes.map((m, i) => (
          <div key={i} className={`flex ${m.remitente === "empleado" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-[10px] px-3.5 py-2.5 text-[14px] leading-snug ${
                m.remitente === "empleado" ? "bg-accent text-white" : "border border-border bg-surface-raised text-text"
              }`}
            >
              {m.texto}
            </div>
          </div>
        ))}
        <div ref={finRef} />
      </div>

      <div className="sticky bottom-0 border-t border-border bg-surface-raised px-4 py-3.5">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          {error && <p className="text-[13px] text-alert">{error}</p>}

          {entrada === "menu" && opciones && (
            <div className="flex flex-col gap-1.5">
              {opciones.map((o) => (
                <button
                  key={o.value}
                  disabled={enviando}
                  onClick={() => enviar(o.value, o.label)}
                  className="rounded-[8px] border border-border-strong bg-surface-raised px-3.5 py-2.5 text-left text-[14px] text-text transition-colors hover:border-accent hover:bg-accent-100 disabled:opacity-50"
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          {entrada === "fecha" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (fecha) enviar(fecha, new Date(`${fecha}T00:00:00Z`).toLocaleDateString("es-AR", { timeZone: "UTC" }));
              }}
              className="flex gap-2"
            >
              <input
                type="date"
                required
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                className="h-11 flex-1 rounded-[8px] border border-border-strong bg-surface-raised px-3 text-[15px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <Button type="submit" variant="primary" disabled={enviando || !fecha}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}

          {entrada === "texto" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (texto.trim()) enviar(texto.trim(), texto.trim());
              }}
              className="flex gap-2"
            >
              <input
                autoFocus
                required
                placeholder="Escribí acá…"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                className="h-11 flex-1 rounded-[8px] border border-border-strong bg-surface-raised px-3.5 text-[15px] text-text outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
              <Button type="submit" variant="primary" disabled={enviando || !texto.trim()}>
                <Send className="h-4 w-4" />
              </Button>
            </form>
          )}

          {entrada === "archivo" && (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) subirArchivo(file);
                }}
              />
              <Button variant="primary" block onClick={() => fileInputRef.current?.click()} disabled={enviando}>
                <Paperclip className="h-4 w-4" />
                {enviando ? "Subiendo…" : "Adjuntar certificado (foto o PDF)"}
              </Button>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
