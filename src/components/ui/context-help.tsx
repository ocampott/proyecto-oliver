import type { ReactNode } from "react";

export function ContextHelp({ label, children }: { label: string; children: ReactNode }) {
  return <details className="mt-2 text-sm text-text-secondary">
    <summary className="w-fit cursor-pointer py-1 font-medium text-accent-700">{label}</summary>
    <div className="mt-2 max-w-prose space-y-2 border-l-2 border-border pl-3 leading-relaxed">{children}</div>
  </details>;
}
