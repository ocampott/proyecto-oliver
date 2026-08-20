import * as React from "react";
import { cn } from "../../lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, className, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:bg-black/[.03] disabled:pointer-events-none disabled:opacity-45",
        className
      )}
      {...props}
    >
      {icon}
    </button>
  )
);
IconButton.displayName = "IconButton";

export { IconButton };
