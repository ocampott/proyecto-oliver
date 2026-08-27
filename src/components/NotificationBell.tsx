import * as React from "react";
import { Bell } from "lucide-react";
import { cn } from "../lib/utils";

interface NotificacionMock {
  id: string;
  titulo: string;
  detalle: string;
  hace: string;
}

// Datos de ejemplo — todavía no hay backend de notificaciones.
// Cuando se implemente, esto se reemplaza por datos reales (fetch/realtime)
// y el estado de leídas pasa a persistirse server-side en vez de en memoria.
const NOTIFICACIONES_MOCK: NotificacionMock[] = [
  {
    id: "1",
    titulo: "Nuevo empleado agregado",
    detalle: "Juan Pérez fue agregado a Sucursal Centro.",
    hace: "hace 2 horas",
  },
  {
    id: "2",
    titulo: "Ausencia pendiente de aprobación",
    detalle: "María González solicitó una licencia.",
    hace: "hace 5 horas",
  },
  {
    id: "3",
    titulo: "Límite de plan cerca",
    detalle: "Estás usando 4 de 5 empleados en el plan Gratis.",
    hace: "ayer",
  },
];

export function NotificationBell() {
  const [open, setOpen] = React.useState(false);
  const [leidas, setLeidas] = React.useState<Set<string>>(new Set());
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  const noLeidas = NOTIFICACIONES_MOCK.filter((n) => !leidas.has(n.id));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notificaciones"
        className="relative inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[8px] text-text-secondary transition-colors hover:bg-text/[.04] hover:text-text"
      >
        <Bell className="h-[18px] w-[18px]" />
        {noLeidas.length > 0 && (
          <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full bg-alert" aria-hidden="true" />
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[320px] rounded-[10px] border border-border bg-surface-raised p-1.5 shadow-[0_8px_24px_rgba(13,13,17,.1)]">
          <div className="flex items-center justify-between gap-2 border-b border-border px-2.5 pb-2 pt-1">
            <p className="m-0 text-[13.5px] font-bold text-text">Notificaciones</p>
            {noLeidas.length > 0 && (
              <button
                onClick={() => setLeidas(new Set(NOTIFICACIONES_MOCK.map((n) => n.id)))}
                className="cursor-pointer whitespace-nowrap text-[12px] font-medium text-accent-700 hover:underline"
              >
                Marcar todas como vistas
              </button>
            )}
          </div>
          <div className="flex flex-col gap-0.5 pt-1">
            {NOTIFICACIONES_MOCK.map((n) => {
              const esNoLeida = !leidas.has(n.id);
              return (
                <div key={n.id} className={cn("flex gap-2.5 rounded-[8px] px-2.5 py-2", esNoLeida && "bg-accent-100/50")}>
                  <span
                    className={cn(
                      "mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full",
                      esNoLeida ? "bg-alert" : "bg-transparent"
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <p className="m-0 text-[13px] font-semibold text-text">{n.titulo}</p>
                    <p className="m-0 text-[12.5px] text-text-secondary">{n.detalle}</p>
                    <p className="m-0 text-[11.5px] text-text-tertiary">{n.hace}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
