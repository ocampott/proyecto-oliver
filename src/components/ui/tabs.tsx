import { cn } from "../../lib/utils";

export interface TabItem<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export interface TabsProps<T extends string> {
  value: T;
  onChange: (value: T) => void;
  items: TabItem<T>[];
  className?: string;
}

function Tabs<T extends string>({ value, onChange, items, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn("flex items-center gap-5 border-b border-border", className)}>
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex items-center gap-1.5 border-b-2 pb-3 text-[13.5px] font-medium transition-colors",
              active ? "border-accent text-text" : "border-transparent text-text-tertiary hover:text-text-secondary"
            )}
          >
            {item.label}
            {item.count != null && item.count > 0 && (
              <span
                className={cn(
                  "rounded-[6px] px-1.5 py-0.5 text-[11px] font-mono",
                  active ? "bg-accent-100 text-accent-800" : "bg-text/[.06] text-text-tertiary"
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

export { Tabs };
