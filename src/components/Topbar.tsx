import { Menu, Search } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { NotificationBell } from "./NotificationBell";
import { AccountMenu } from "./AccountMenu";
import { tituloDeRuta } from "./Sidebar";
import { usePageChrome } from "./PageHeader";

export function Topbar({
  onMenuClick,
  onOpenSearch,
}: {
  onMenuClick: () => void;
  onOpenSearch: () => void;
}) {
  const location = useLocation();
  const fallbackTitulo = tituloDeRuta(location.pathname);
  const { title, description, meta, actions, breadcrumb } = usePageChrome();

  return (
    <header className="sticky top-0 z-20 flex min-h-20 shrink-0 flex-wrap items-center gap-x-3 gap-y-3 border-b border-border-soft bg-bg px-4 py-4 sm:px-6 lg:px-8">
      <button
        onClick={onMenuClick}
        aria-label="Abrir menú"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] text-text-secondary hover:bg-text/[.04] md:hidden"
      >
        <Menu className="h-[18px] w-[18px]" />
      </button>

      <div className="min-w-0 flex-1">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-[12px] leading-tight text-text-tertiary">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i > 0 && <span aria-hidden="true">/</span>}
                {b.href ? (
                  <Link to={b.href} className="hover:text-text-secondary">
                    {b.label}
                  </Link>
                ) : (
                  <span className="text-text-secondary">{b.label}</span>
                )}
              </span>
            ))}
          </nav>
        )}
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <h1 className="text-[20px] font-semibold leading-tight tracking-[-0.01em] text-text">
            {title ?? fallbackTitulo}
          </h1>
          {meta && <div className="text-[12px] text-text-tertiary">{meta}</div>}
        </div>
        {description && (
          <p className="mt-1 hidden text-[13px] leading-normal sm:block text-text-tertiary">{description}</p>
        )}
      </div>

      {actions && <div className="order-last flex w-full flex-wrap items-center gap-2 xl:order-none xl:w-auto">{actions}</div>}

      <button
        type="button"
        onClick={onOpenSearch}
        aria-label="Buscar"
        className="flex h-9 shrink-0 items-center gap-2 rounded-[8px] border border-border bg-surface-raised px-3 text-[13px] text-text-tertiary hover:bg-surface hover:text-text-secondary"
      >
        <Search className="h-[15px] w-[15px] shrink-0" />
        <span className="hidden lg:inline">Buscar…</span>
        <span className="hidden font-mono text-[12px] text-text-muted lg:inline">⌘K</span>
      </button>

      <NotificationBell />
      <AccountMenu />
    </header>
  );
}
