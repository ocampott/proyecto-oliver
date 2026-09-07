import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export interface MobileRecord {
  id: string;
  title: string;
  description?: ReactNode;
  meta?: ReactNode;
  actionLabel: string;
  onOpen: () => void;
  actions?: ReactNode;
}

/** Same query and pagination as desktop; no second fetch or hidden form IDs. */
export function MobileRecords({ items, loading }: { items: MobileRecord[]; loading?: boolean }) {
  return <div className="mt-4 md:hidden">
    {loading ? <p role="status" className="py-4 text-text-secondary">Cargando…</p> :
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface-raised">
        {items.map(item => <li key={item.id}>
          <button type="button" onClick={item.onOpen} aria-label={item.actionLabel} className="flex min-h-20 w-full items-center gap-3 p-4 text-left hover:bg-surface/60">
            <span className="min-w-0 flex-1 break-words">
              <span className="block font-semibold">{item.title}</span>
              {item.description && <span className="mt-1 block text-sm text-text-secondary">{item.description}</span>}
              {item.meta && <span className="mt-2 block text-xs text-text-tertiary">{item.meta}</span>}
            </span>
            <ChevronRight className="size-4 shrink-0 text-text-tertiary" />
          </button>
          {item.actions && <details className="px-4 pb-3"><summary className="w-fit cursor-pointer py-1 text-sm font-medium text-accent-700">Acciones</summary><div className="mt-2 [&_.row-actions]:opacity-100 [&_.row-actions]:justify-start">{item.actions}</div></details>}
        </li>)}
      </ul>}
  </div>;
}
