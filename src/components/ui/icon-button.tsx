import * as React from "react";
import { cn } from "../../lib/utils";
import { useHoverTooltip } from "./tooltip";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
  side?: "top" | "right";
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, side = "top", className, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, forwardedRef) => {
    const { triggerProps, tooltipNode } = useHoverTooltip<HTMLButtonElement>(label, side);

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        triggerProps.ref.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.RefObject<HTMLButtonElement | null>).current = node;
      },
      [forwardedRef, triggerProps.ref]
    );

    return (
      <>
        <button
          ref={setRefs}
          aria-label={label}
          onMouseEnter={(e) => {
            triggerProps.onMouseEnter();
            onMouseEnter?.(e);
          }}
          onMouseLeave={(e) => {
            triggerProps.onMouseLeave();
            onMouseLeave?.(e);
          }}
          onFocus={(e) => {
            triggerProps.onFocus();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            triggerProps.onBlur();
            onBlur?.(e);
          }}
          className={cn(
            "inline-flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-lg border border-border bg-white text-text-secondary transition-colors hover:bg-black/[.03] disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-45",
            className
          )}
          {...props}
        >
          {icon}
        </button>
        {tooltipNode}
      </>
    );
  }
);
IconButton.displayName = "IconButton";

export { IconButton };
