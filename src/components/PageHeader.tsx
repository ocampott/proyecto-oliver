import type { ReactNode } from "react";

export interface PageHeaderProps {
  kicker: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
}

/** Encabezado editorial compartido por todas las pantallas internas. */
export function PageHeader({ kicker, title, description, meta, actions }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-accent">{kicker}</p>
        <h1 className="mt-2 text-balance text-3xl font-semibold tracking-[-0.055em] text-text md:text-5xl">{title}</h1>
        {description && <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">{description}</p>}
      </div>
      {(meta || actions) && <div className="flex shrink-0 flex-wrap items-center gap-3 md:justify-end">{meta && <p className="font-mono text-[11px] text-text-tertiary">{meta}</p>}{actions}</div>}
    </header>
  );
}
