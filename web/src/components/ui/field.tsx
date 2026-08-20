import * as React from "react";
import { Input, type InputProps } from "./input";
import { cn } from "../../lib/utils";

export interface FieldProps extends InputProps {
  label: string;
  containerClassName?: string;
  icon?: React.ReactNode;
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, containerClassName, icon, id, className, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
      <div className={cn("flex flex-col gap-[5px]", containerClassName)}>
        <label htmlFor={inputId} className="text-[12px] text-text/70">
          {label}
        </label>
        {icon ? (
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary">
              {icon}
            </span>
            <Input id={inputId} ref={ref} className={cn("pl-9", className)} {...props} />
          </div>
        ) : (
          <Input id={inputId} ref={ref} className={className} {...props} />
        )}
      </div>
    );
  }
);
Field.displayName = "Field";

export { Field };
