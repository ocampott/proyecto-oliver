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
}

function MultiSelect({ label, options, value, onChange, placeholder = "Elegí opciones", containerClassName }: MultiSelectProps) {
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

  return (
    <div ref={ref} className={cn("relative flex flex-col gap-[5px]", containerClassName)}>
      <label htmlFor={autoId} className="text-[12px] text-text/70">
        {label}
      </label>
      <button
        id={autoId}
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-10 w-full items-center justify-between rounded-[9px] border border-border bg-white px-3 py-2 text-left text-[15px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className={cn("truncate", value.length === 0 && "text-text-tertiary")}>{summary}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-text-tertiary" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-20 flex max-h-72 w-full flex-col overflow-hidden rounded-[12px] border border-border-soft bg-white shadow-[0_16px_40px_rgba(24,24,27,.18),0_3px_10px_rgba(24,24,27,.06)]">
          <div className="border-b border-border-soft p-2">
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
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] text-text hover:bg-black/[.03]"
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
            {filtered.length === 0 && <li className="px-2.5 py-2 text-[13.5px] text-text/50">Sin resultados.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

export { MultiSelect };
