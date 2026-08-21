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
}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, options, containerClassName, className, id, ...props }, ref) => {
    const autoId = React.useId();
    const selectId = id ?? autoId;
    return (
      <div className={cn("flex flex-col gap-[5px]", containerClassName)}>
        <label htmlFor={selectId} className="text-[12px] text-text/70">
          {label}
        </label>
        <div className="relative">
          <select
            id={selectId}
            ref={ref}
            className={cn(
              "flex h-10 w-full appearance-none rounded-[9px] border border-border bg-white px-3 py-2 pr-9 text-[15px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
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
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
        </div>
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
