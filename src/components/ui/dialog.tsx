import * as React from "react";
import { X } from "lucide-react";
import { useModal } from "./use-modal";
import { cn } from "../../lib/utils";

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

function Dialog({ open, onClose, title, children, className }: DialogProps) {
  const ref = useModal(open);
  const titleId = React.useId();

  if (!open) return null;

  return (
    <dialog ref={ref} aria-labelledby={titleId}
      className="m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-none overflow-visible border-0 bg-transparent p-0 backdrop:bg-text/40 backdrop:backdrop-blur-[2px]"
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className={cn(
          "mx-auto flex max-h-[calc(100dvh-2rem)] w-full max-w-[440px] flex-col gap-4 overflow-y-auto rounded-[10px] border border-border bg-surface-raised p-5 sm:p-6 shadow-[0_16px_48px_rgba(13,13,17,.18)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <h2 id={titleId} className="text-[18px] font-semibold tracking-[-0.02em] text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] bg-text/5 text-text-secondary hover:bg-text/10"
            aria-label="Cerrar"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}

export { Dialog };
