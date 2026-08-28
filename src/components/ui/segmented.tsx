import { cn } from "../../lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  /** Nombre accesible del grupo: el radiogroup no tiene label visible. */
  "aria-label"?: string;
}

function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  "aria-label": ariaLabel,
}: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-[8px] border border-border-strong bg-surface p-0.5 shadow-[inset_0_1px_2px_rgba(13,13,17,0.04)]",
        className
      )}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors",
            opt.value === value
              ? "bg-surface-raised text-text shadow-[0_1px_3px_rgba(13,13,17,0.14),0_1px_1px_rgba(13,13,17,0.08)]"
              : "text-text-secondary hover:text-text"
          )}
        >
          {opt.label}
          {opt.count != null && (
            <span className={cn("font-mono text-[10.5px]", opt.value === value ? "text-text-tertiary" : "text-text-muted")}>
              {opt.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export { Segmented };
