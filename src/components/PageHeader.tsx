import type { ReactNode } from "react";

export interface PageHeaderProps {
  kicker: string;
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
}

/** Encabezado editorial compartido por todas las pantallas internas — mismo tratamiento que Resumen. */
export function PageHeader({ kicker, title, description, meta }: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-2 border-b border-border pb-6 md:flex-row md:items-end md:justify-between">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">{kicker}</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-[-0.06em] text-text md:text-5xl">{title}</h1>
        {description && <p className="mt-2 text-sm text-text-secondary">{description}</p>}
      </div>
      {meta && <p className="font-mono text-xs text-text-tertiary">{meta}</p>}
    </header>
  );
}
