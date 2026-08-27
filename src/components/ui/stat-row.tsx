import * as React from "react";
import { cn } from "../../lib/utils";

export interface StatRowItem {
  label: string;
  value: React.ReactNode;
  meta?: React.ReactNode;
  tone?: "default" | "warning" | "alert";
}

export interface StatRowProps extends React.HTMLAttributes<HTMLDivElement> {
  stats: StatRowItem[];
}

const TONE_CLASS = {
  default: "text-text",
  warning: "text-warning",
  alert: "text-alert",
} as const;

function StatRow({ stats, className, style, ...props }: StatRowProps) {
  return (
    <div
      className={cn("grid divide-x divide-border overflow-hidden rounded-[10px] border border-border bg-surface-raised", className)}
      style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`, ...style }}
      {...props}
    >
      {stats.map((s, i) => (
        <div key={i} className="px-5 py-4">
          <p className="text-[11.5px] font-semibold uppercase tracking-wide text-text-tertiary">{s.label}</p>
          <p className={cn("data-number mt-1 text-[26px] font-medium", TONE_CLASS[s.tone ?? "default"])}>
            {s.value}
          </p>
          {s.meta && <p className="mt-0.5 text-[12.5px] text-text-secondary">{s.meta}</p>}
        </div>
      ))}
    </div>
  );
}

export { StatRow };
