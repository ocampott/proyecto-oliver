import * as React from "react";
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
        <select
          id={selectId}
          ref={ref}
          className={cn(
            "flex h-10 w-full border border-divider bg-bg px-3 py-2 text-[15px] text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50",
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
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
