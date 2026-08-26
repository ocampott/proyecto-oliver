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
        "ml-auto inline-flex items-center gap-1 text-[13px] font-medium text-text-secondary hover:text-text",
        className
      )}
    >
      <X className="h-3.5 w-3.5" />
      Limpiar filtros
    </button>
  );
}

export { ClearFiltersButton };
