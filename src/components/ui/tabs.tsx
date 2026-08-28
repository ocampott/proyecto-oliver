import * as React from "react";
import { cn } from "../../lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  className?: string;
}

/**
 * Props para la región de contenido de la pestaña `value`. Se spreadean
 * sobre el elemento raíz del panel:
 *
 *   <section {...tabPanelProps("registros")} className="page-section">…</section>
 *
 * Si el panel es un componente (no un elemento DOM), envolverlo en un div:
 *
 *   <div {...tabPanelProps("miembros")}><MiembrosTab orgId={orgId} /></div>
 *
 * El string tiene que ser el mismo `value` del TabItem correspondiente:
 * de ahí salen los ids que `Tabs` referencia con aria-controls.
 */
export function tabPanelProps(value: string) {
  return {
    id: `tabpanel-${value}`,
    role: "tabpanel" as const,
    "aria-labelledby": `tab-${value}`,
    tabIndex: 0,
  };
}

function Tabs<T extends string>({ value, onChange, items, className }: TabsProps<T>) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([]);

  // Navegación APG: flechas mueven entre tabs (con wrap), Home/End a los
  // extremos. El foco sigue a la selección, que es el modo "automatic
  // activation" — el panel se monta al instante, igual que con el click.
  function handleKeyDown(e: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const last = items.length - 1;
    let next: number;
    if (e.key === "ArrowRight") next = index === last ? 0 : index + 1;
    else if (e.key === "ArrowLeft") next = index === 0 ? last : index - 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = last;
    else return;
    e.preventDefault();
    onChange(items[next].value);
    refs.current[next]?.focus();
  }

  return (
    <div role="tablist" className={cn("flex items-center gap-5 border-b border-border", className)}>
      {items.map((item, index) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${item.value}`}
            aria-controls={`tabpanel-${item.value}`}
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.value)}
            onKeyDown={(e) => handleKeyDown(e, index)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 pb-3 text-[13.5px] font-medium transition-colors",
              active ? "border-accent text-text" : "border-transparent text-text-tertiary hover:text-text-secondary"
            )}
          >
            {item.label}
            {item.count != null && item.count > 0 && (
              <span
                className={cn(
                  "rounded-[6px] px-1.5 py-0.5 text-[11px] font-mono",
                  active ? "bg-accent-100 text-accent-800" : "bg-text/[.06] text-text-tertiary"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { Tabs };
