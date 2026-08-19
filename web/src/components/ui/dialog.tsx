import * as React from "react";
import { cn } from "../../lib/utils";
import { Button } from "./button";

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
    <div className="fixed inset-0 z-50 grid place-items-center bg-[#201e1d]/50 p-4" onClick={onClose}>
      <div
        className={cn(
          "flex w-full max-w-[440px] flex-col gap-3 bg-surface p-4 shadow-[0_12px_32px_rgba(32,30,29,0.22)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[20px] font-extrabold text-text">{title}</span>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { Dialog };
