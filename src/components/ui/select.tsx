import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/utils";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  containerClassName?: string;
  /** Control compacto de Toolbar: sin label visible (pasa a aria-label), h-8. */
  compact?: boolean;
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, containerClassName, compact, className, id, ...props }, ref) => {
    const autoId = React.useId();
    const selectId = id ?? autoId;

    const selectEl = (
      <div className="relative">
        <select
          id={selectId}
          ref={ref}
          aria-label={compact ? label : undefined}
          className={cn(
            "flex w-full appearance-none rounded-[8px] border border-border bg-surface-raised text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
            compact ? "h-8 px-2.5 pr-8 text-[13px]" : "h-10 px-3 py-2 pr-9 text-[15px]",
            className
          )}
          {...props}
        >
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <ChevronDown
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-text-tertiary",
            compact ? "right-2.5 h-3.5 w-3.5" : "right-3 h-4 w-4"
          )}
        />
      </div>
    );

    if (compact) {
      return <div className={containerClassName}>{selectEl}</div>;
    }

    return (
      <div className={cn("flex flex-col gap-[5px]", containerClassName)}>
        <label htmlFor={selectId} className="text-[12px] text-text-secondary">
          {label}
        </label>
        {selectEl}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
