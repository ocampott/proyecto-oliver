import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: PageHeaderBreadcrumb[];
}

/** Encabezado compartido por todas las pantallas internas. */
export function PageHeader({ title, description, meta, actions, breadcrumb }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {breadcrumb && breadcrumb.length > 0 && (
          <nav aria-label="Breadcrumb" className="mb-1.5 flex items-center gap-1.5 text-[12.5px] text-text-tertiary">
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
        <h1 className="text-[26px] font-semibold tracking-[-0.02em] text-text md:text-[28px]">
          {title}
        </h1>
        {description && <p className="mt-1.5 text-sm text-text-secondary">{description}</p>}
      </div>
      {(meta || actions) && (
        <div className="flex shrink-0 items-center gap-3">
          {meta && <p className="font-mono text-xs text-text-tertiary">{meta}</p>}
          {actions}
        </div>
      )}
    </header>
  );
}
