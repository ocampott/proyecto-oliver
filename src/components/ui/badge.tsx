import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-[6px] px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide",
  {
    variants: {
      variant: {
        filled: "bg-text text-white",
        outline: "border border-accent-700 text-accent-700",
        accent: "bg-accent-100 text-accent-800",
        neutral: "bg-text/[.06] text-text-secondary",
        alert: "bg-alert-100 text-alert",
      },
    },
    defaultVariants: { variant: "outline" },
  }
);

export type BadgeTone = "ok" | "warn" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<BadgeTone, string> = {
  ok: "bg-success-100 text-success-700",
  warn: "bg-warning/15 text-warning",
  danger: "bg-alert-100 text-alert",
  info: "bg-accent-100 text-accent-800",
  neutral: "bg-text/[.06] text-text-secondary",
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {
  /** Pastilla de tono (estilo R3) — mutuamente excluyente con `variant`. */
  tone?: BadgeTone;
}

function Badge({ className, variant, tone, ...props }: BadgeProps) {
  if (tone) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1 rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium leading-4",
          TONE_CLASSES[tone],
          className
        )}
        {...props}
      />
    );
  }
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
