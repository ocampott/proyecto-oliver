import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "./input";
import { cn } from "../../lib/utils";

export interface PasswordFieldProps extends Omit<InputProps, "type"> {
  label: string;
  containerClassName?: string;
}

const PasswordField = React.forwardRef<HTMLInputElement, PasswordFieldProps>(
  ({ label, containerClassName, id, className, ...props }, ref) => {
    const autoId = React.useId();
    const inputId = id ?? autoId;
    const [visible, setVisible] = React.useState(false);

    return (
      <div className={cn("flex flex-col gap-[5px]", containerClassName)}>
        <label htmlFor={inputId} className="text-[12px] text-text-secondary">
          {label}
        </label>
        <div className="relative">
          <Input
            id={inputId}
            ref={ref}
            type={visible ? "text" : "password"}
            className={cn("pr-9", className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 cursor-pointer text-text-tertiary hover:text-text-secondary"
          >
            {visible ? <EyeOff className="h-[15px] w-[15px]" /> : <Eye className="h-[15px] w-[15px]" />}
          </button>
        </div>
      </div>
    );
  }
);
PasswordField.displayName = "PasswordField";

export { PasswordField };
