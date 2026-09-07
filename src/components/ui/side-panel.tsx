import * as React from "react";
import { X } from "lucide-react";
import { useModal } from "./use-modal";
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
  const ref = useModal(open);
  const titleId = React.useId();

  if (!open) return null;

  return (
    <dialog ref={ref} aria-labelledby={titleId}
      className="m-0 ml-auto h-dvh max-h-none w-full max-w-[420px] border-0 bg-transparent p-0 backdrop:bg-text/40 backdrop:backdrop-blur-[2px]"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div
        className={cn(
          "flex h-full w-full max-w-[420px] flex-col border-l border-border bg-surface-raised shadow-[-16px_0_48px_rgba(13,13,17,.18)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-5 py-4">
          <h2 id={titleId} className="text-[18px] font-semibold tracking-[-0.01em] text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-text/5 text-text-secondary hover:bg-text/10"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="shrink-0 border-t border-border px-5 py-4">{footer}</div>}
      </div>
    </dialog>
  );
}

export { SidePanel };
