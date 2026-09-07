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
      className={cn("stat-grid overflow-hidden rounded-[10px] border border-border", className)}
      style={{ "--stat-columns": Math.max(stats.length, 1), ...style } as React.CSSProperties}
      {...props}
    >
      {stats.map((s, i) => (
        <div key={i} className="min-w-0 px-4 py-4 sm:px-5">
          <p className="text-[12px] font-medium text-text-tertiary">{s.label}</p>
          <p className={cn("data-number mt-1 text-[24px] sm:text-[28px] leading-tight font-medium", TONE_CLASS[s.tone ?? "default"])}>
            {s.value}
          </p>
          {s.meta && <p className="mt-0.5 text-[12px] text-text-secondary">{s.meta}</p>}
        </div>
      ))}
    </div>
  );
}

export { StatRow };
