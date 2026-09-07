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
      <div className={cn("flex flex-col gap-1.5", containerClassName)}>
        <label htmlFor={inputId} className="text-[13px] font-medium text-text-secondary">
          {label}
        </label>
        <div className="relative">
          <Input
            id={inputId}
            ref={ref}
            type={visible ? "text" : "password"}
            className={cn("pr-12", className)}
            {...props}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
            className="absolute right-1 top-1/2 flex h-9 w-9 items-center justify-center rounded-lg -translate-y-1/2 cursor-pointer text-text-tertiary hover:text-text-secondary"
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
