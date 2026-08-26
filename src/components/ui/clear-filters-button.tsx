import { X } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ClearFiltersButtonProps {
  onClick: () => void;
  className?: string;
}

function ClearFiltersButton({ onClick, className }: ClearFiltersButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "ml-auto inline-flex items-center gap-1 font-mono text-[11px] font-medium uppercase tracking-[0.04em] text-text-secondary hover:text-text",
        className
      )}
    >
      <X className="h-3.5 w-3.5" />
      Limpiar filtros
    </button>
  );
}

export { ClearFiltersButton };
