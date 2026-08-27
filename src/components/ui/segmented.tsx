import { cn } from "../../lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
}

function Segmented<T extends string>({ value, onChange, options, className }: SegmentedProps<T>) {
  return (
    <div role="radiogroup" className={cn("inline-flex items-center gap-0.5 rounded-[8px] bg-surface p-0.5", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "rounded-[6px] px-3 py-1.5 text-[13px] font-medium transition-colors",
            opt.value === value
              ? "bg-surface-raised text-text"
              : "text-text-secondary hover:text-text"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

export { Segmented };
