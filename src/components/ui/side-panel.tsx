import * as React from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}

function SidePanel({ open, onClose, title, children, footer, className }: SidePanelProps) {
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
    <div className="fixed inset-0 z-50 flex justify-end bg-text/40 backdrop-blur-[2px]" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          "flex h-full w-full max-w-[420px] flex-col border-l border-border bg-surface-raised",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
          <span className="text-[16px] font-semibold tracking-[-0.01em] text-text">{title}</span>
          <button
            onClick={onClose}
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] bg-text/5 text-text-secondary hover:bg-text/10"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </div>
  );
}

export { SidePanel };
