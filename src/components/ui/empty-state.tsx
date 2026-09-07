import type { ReactNode } from "react";

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <div className="flex flex-col items-center gap-3 whitespace-normal px-4 py-8 text-center">
    <div className="max-w-sm"><h2 className="text-base font-semibold text-text">{title}</h2><p className="mt-1 text-sm text-text-secondary">{description}</p></div>
    {action}
  </div>;
}
