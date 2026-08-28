import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Dialog({ open, onClose, title, children, className }: DialogProps) {
  React.useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-text/40 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex w-full max-w-[440px] flex-col gap-3 rounded-[10px] border border-border bg-surface-raised p-[26px] shadow-[0_16px_48px_rgba(13,13,17,.18)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[18px] font-semibold tracking-[-0.02em] text-text">{title}</span>
          <button
            onClick={onClose}
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-text/5 text-text-secondary hover:bg-text/10"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { Dialog };
