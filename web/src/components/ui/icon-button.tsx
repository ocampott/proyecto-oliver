import * as React from "react";
import { cn } from "../../lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, className, ...props }, ref) => (
    <span className="group relative inline-flex">
      <button
        ref={ref}
        aria-label={label}
        className={cn(
          "inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:bg-black/[.03] disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-45",
          className
        )}
        {...props}
      >
        {icon}
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute bottom-[calc(100%+6px)] left-1/2 z-30 -translate-x-1/2 whitespace-nowrap rounded-md bg-text px-2 py-1 text-[11.5px] font-medium text-white opacity-0 transition-opacity delay-300 duration-150 group-hover:opacity-100"
      >
        {label}
      </span>
    </span>
  )
);
IconButton.displayName = "IconButton";

export { IconButton };
