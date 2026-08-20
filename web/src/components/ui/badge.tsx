import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold",
  {
    variants: {
      variant: {
        filled: "bg-text text-white",
        outline: "border border-accent-700 text-accent-700",
        accent: "bg-accent-100 text-accent-800",
        neutral: "bg-black/[.06] text-text-secondary",
        alert: "bg-[--color-alert-100] text-[--color-alert]",
      },
    },
    defaultVariants: { variant: "outline" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
