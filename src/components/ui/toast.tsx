import * as React from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "../../lib/utils";

interface ToastItem {
  id: number;
  type: "success" | "error";
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | undefined>(undefined);

let nextId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastItem[]>([]);

  const dismiss = React.useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (type: ToastItem["type"], message: string) => {
      const id = ++nextId;
      setToasts((prev) => [...prev, { id, type, message }]);
      window.setTimeout(() => dismiss(id), type === "error" ? 6000 : 4000);
    },
    [dismiss]
  );

  const value = React.useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => push("success", message),
      error: (message: string) => push("error", message),
    }),
    [push]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end">
          {toasts.map((t) => (
            <div
              key={t.id}
              role="status"
              className={cn(
                "pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-[10px] border bg-surface-raised p-3.5 shadow-[0_8px_24px_rgba(13,13,17,.12)]",
                t.type === "success" ? "border-success/30" : "border-alert/30"
              )}
            >
              {t.type === "success" ? (
                <CheckCircle2 className="mt-0.5 h-[18px] w-[18px] shrink-0 text-success-700" />
              ) : (
                <AlertCircle className="mt-0.5 h-[18px] w-[18px] shrink-0 text-alert" />
              )}
              <p className="flex-1 text-[13.5px] leading-snug text-text">{t.message}</p>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Cerrar"
                className="shrink-0 text-text-muted hover:text-text"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast debe usarse dentro de <ToastProvider>");
  return ctx;
}
