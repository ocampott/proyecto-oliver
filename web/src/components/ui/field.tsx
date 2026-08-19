import * as React from "react";
import { Input, type InputProps } from "./input";
import { cn } from "../../lib/utils";

export interface FieldProps extends InputProps {
  label: string;
  containerClassName?: string;
}

const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ label, containerClassName, id, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    return (
      <div className={cn("flex flex-col gap-[5px]", containerClassName)}>
        <label htmlFor={inputId} className="text-[12px] text-text/70">
          {label}
        </label>
        <Input id={inputId} ref={ref} {...props} />
      </div>
    );
  }
);
Field.displayName = "Field";

export { Field };
