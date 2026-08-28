import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "./input";
import { cn } from "../../lib/utils";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  label: string;
  options: MultiSelectOption[];
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  containerClassName?: string;
  /**
   * "field" (default): caja con label arriba, igual que Field/Select.
   * "compact": trigger h-8 para la fila de filtros del Toolbar, con el
   * mismo aspecto que <Select compact> — el label pasa a aria-label.
   */
  variant?: "field" | "compact";
}

function MultiSelect({
  label,
  options,
  value,
  onChange,
  placeholder = "Elegí opciones",
  containerClassName,
  variant = "field",
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);
  const autoId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  function toggle(v: string) {
    onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  }

  const filtered = options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()));
  const summary =
    value.length === 0
      ? placeholder
      : value.length === 1
        ? (options.find((o) => o.value === value[0])?.label ?? "1 seleccionado")
        : `${value.length} seleccionados`;

  const isCompact = variant === "compact";

  return (
    <div ref={ref} className={cn(isCompact ? "relative" : "relative flex flex-col gap-[5px]", containerClassName)}>
      {!isCompact && (
        <label htmlFor={autoId} className="text-[12px] text-text-secondary">
          {label}
        </label>
      )}
      <button
        id={autoId}
        type="button"
        aria-label={isCompact ? label : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between rounded-[8px] border border-border-strong bg-surface-raised text-left text-text shadow-[0_1px_2px_rgba(13,13,17,0.05)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          isCompact ? "h-8 px-2.5 text-[13px]" : "h-10 px-3 py-2 text-[15px]"
        )}
      >
        <span className={cn("truncate", value.length === 0 && "text-text-tertiary")}>
          {isCompact && value.length > 0 ? `${label}: ${summary}` : summary}
        </span>
        <ChevronDown
          className={cn("shrink-0 text-text-tertiary", isCompact ? "h-3.5 w-3.5" : "h-4 w-4")}
        />
      </button>
      {open && (
        <div
          className={cn(
            "absolute left-0 top-[calc(100%+4px)] z-20 flex max-h-72 flex-col overflow-hidden rounded-[10px] border border-border bg-surface-raised shadow-[0_8px_24px_rgba(13,13,17,.1)]",
            isCompact ? "w-[240px]" : "w-full"
          )}
        >
          <div className="border-b border-border p-2">
            <Input
              autoFocus
              placeholder="Buscar..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-8 text-[13.5px]"
            />
          </div>
          <ul className="flex-1 overflow-y-auto p-1">
            {filtered.map((o) => {
              const checked = value.includes(o.value);
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => toggle(o.value)}
                    className="flex w-full items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-[13.5px] text-text hover:bg-text/[.04]"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                        checked ? "border-accent bg-accent text-white" : "border-border"
                      )}
                    >
                      {checked && <Check className="h-3 w-3" />}
                    </span>
                    {o.label}
                  </button>
                </li>
              );
            })}
            {filtered.length === 0 && <li className="px-2.5 py-2 text-[13.5px] text-text-tertiary">Sin resultados.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export { MultiSelect };
