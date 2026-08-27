import { Menu, Search } from "lucide-react";
import { useOrgActual } from "../lib/hooks";

export function MobileHeader({
  onMenuClick,
  onSearchClick,
}: {
  onMenuClick: () => void;
  onSearchClick: () => void;
}) {
  const { data: org } = useOrgActual();
  return (
    <header className="flex items-center gap-3 border-b border-border-soft bg-surface-raised px-4 py-3 md:hidden">
      <button
        onClick={onMenuClick}
        aria-label="Abrir menú"
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-secondary hover:bg-text/[.04]"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>
      <span className="flex-1 truncate text-[14px] font-semibold text-text">{org?.name ?? "oliver"}</span>
      <button
        onClick={onSearchClick}
        aria-label="Buscar"
        className="flex h-8 w-8 items-center justify-center rounded-[8px] text-text-secondary hover:bg-text/[.04]"
      >
        <Search className="h-[18px] w-[18px]" />
      </button>
    </header>
  );
}
