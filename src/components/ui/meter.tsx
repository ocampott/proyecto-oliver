import * as React from "react";
import { cn } from "../../lib/utils";

export interface MeterProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number;
  max: number;
  warnBelow?: number;
}

function Meter({ value, max, warnBelow, className, ...props }: MeterProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const warn = warnBelow != null && max > 0 && value / max < warnBelow;
  return (
    <div className={cn("flex items-center gap-2", className)} {...props}>
      <div className="h-1.5 w-20 overflow-hidden rounded-full bg-border-soft">
        <div className={cn("h-full rounded-full", warn ? "bg-warning" : "bg-accent")} style={{ width: `${pct}%` }} />
      </div>
      <span className={cn("data-number text-[12.5px]", warn ? "text-warning" : "text-text-secondary")}>
        {Math.round(pct)}%
      </span>
    </div>
  );
}

export { Meter };
