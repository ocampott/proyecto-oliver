import { Menu, Search } from "lucide-react";
import { useLocation } from "react-router-dom";
import { useOrgActual } from "../lib/hooks";
import { NotificationBell } from "./NotificationBell";
import { AccountMenu } from "./AccountMenu";
import { tituloDeRuta } from "./Sidebar";

export function Topbar({
  onMenuClick,
  onOpenSearch,
}: {
  onMenuClick: () => void;
  onOpenSearch: () => void;
}) {
  const location = useLocation();
  const { data: org } = useOrgActual();
  const titulo = tituloDeRuta(location.pathname);

  return (
    <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-border-soft bg-bg px-4 md:px-8">
      <button
        onClick={onMenuClick}
        aria-label="Abrir menú"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-text-secondary hover:bg-text/[.04] md:hidden"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold leading-tight text-text">{titulo}</p>
        <p className="hidden truncate text-[11.5px] leading-tight text-text-tertiary sm:block">{org?.name ?? ""}</p>
      </div>

      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Buscar"
        className="flex h-8 shrink-0 items-center gap-2 rounded-[8px] border border-border bg-surface-raised px-3 text-[13px] text-text-tertiary hover:bg-surface hover:text-text-secondary"
      >
        <Search className="h-[15px] w-[15px] shrink-0" />
        <span className="hidden sm:inline">Buscar…</span>
        <span className="hidden font-mono text-[10.5px] text-text-muted sm:inline">⌘K</span>
      </button>

      <NotificationBell />
      <AccountMenu />
    </header>
  );
}
