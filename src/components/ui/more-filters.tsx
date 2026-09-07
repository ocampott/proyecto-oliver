import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

/** Filters apply immediately; collapsing the disclosure never resets them. */
export function MoreFilters({ activeCount = 0, children }: { activeCount?: number; children: ReactNode }) {
  return (
    <details className="more-filters open:basis-full">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-2 rounded-lg border border-border-strong bg-surface-raised px-3 text-[13px] font-medium shadow-sm hover:bg-surface [&::-webkit-details-marker]:hidden">
        <SlidersHorizontal className="size-4" />
        Más filtros{activeCount > 0 && <span aria-label={`${activeCount} ${activeCount === 1 ? "filtro activo" : "filtros activos"}`} className="rounded bg-accent-100 px-1.5 text-accent-800">{activeCount}</span>}
      </summary>
      <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface-raised p-3 [&>div]:min-w-0 [&>div]:flex-1 [&>div]:basis-40">
        {children}
      </div>
    </details>
  );
}
