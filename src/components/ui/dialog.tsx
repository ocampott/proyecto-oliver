import * as React from "react";
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
      className="fixed inset-0 z-50 grid place-items-center bg-[#18181b]/42 p-4 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className={cn(
          "flex w-full max-w-[440px] flex-col gap-3 rounded-[18px] bg-white p-[26px] shadow-[0_24px_60px_rgba(24,24,27,.22),0_4px_14px_rgba(24,24,27,.08)]",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-2">
          <span className="text-[19px] font-extrabold text-text">{title}</span>
          <button
            onClick={onClose}
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg bg-black/[.05] text-text-secondary hover:bg-black/[.08]"
            aria-label="Cerrar"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" />
              <path d="M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export { Dialog };
