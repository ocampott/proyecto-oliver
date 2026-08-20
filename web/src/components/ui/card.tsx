import * as React from "react";
import { cn } from "../../lib/utils";

const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "rounded-[14px] border border-[--color-border] bg-white p-6 shadow-[0_1px_2px_rgba(24,24,27,.06),0_10px_24px_rgba(24,24,27,.06)]",
        className
      )}
      {...props}
    />
  )
);
Card.displayName = "Card";

export { Card };
