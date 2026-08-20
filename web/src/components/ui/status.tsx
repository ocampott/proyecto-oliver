import * as React from "react";
import { cn } from "../../lib/utils";

const DOT_COLOR = {
  success: "bg-[--color-success]",
  warning: "bg-[--color-warning]",
  neutral: "bg-[--color-text-muted]",
  accent: "bg-accent",
} as const;

const TEXT_COLOR = {
  success: "text-text",
  warning: "text-text",
  neutral: "text-text-muted",
  accent: "text-accent",
} as const;

export interface StatusProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone: keyof typeof DOT_COLOR;
}

function Status({ tone, className, children, ...props }: StatusProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-[7px] text-[13px]", TEXT_COLOR[tone], className)}
      {...props}
    >
      <span className={cn("h-[7px] w-[7px] rounded-full", DOT_COLOR[tone])} />
      {children}
    </span>
  );
}

export { Status };
