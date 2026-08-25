import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface FilterChipOption {
  value: string;
  label: string;
}

export interface FilterChipProps {
  label: string;
  value: string;
  defaultValue: string;
  options: FilterChipOption[];
  onChange: (value: string) => void;
}

function FilterChip({ label, value, defaultValue, options, onChange }: FilterChipProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

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

  const active = value !== defaultValue;
  const activeLabel = options.find((o) => o.value === value)?.label;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
          active
            ? "border-accent-200 bg-accent-100 text-accent-800 hover:bg-accent-200"
            : "border-border bg-white text-text-secondary hover:bg-black/[.03]"
        )}
      >
        {active ? `${label}: ${activeLabel}` : label}
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 min-w-[180px] overflow-hidden rounded-[12px] border border-border-soft bg-white py-1 shadow-[0_16px_40px_rgba(24,24,27,.18),0_3px_10px_rgba(24,24,27,.06)]">
          {options.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-[13.5px] text-text hover:bg-black/[.03]"
            >
              {o.label}
              {o.value === value && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export { FilterChip };
