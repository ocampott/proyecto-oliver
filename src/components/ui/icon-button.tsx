import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../lib/utils";

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: React.ReactNode;
  label: string;
}

const GAP = 6;
const MARGIN = 8;
const SHOW_DELAY = 300;

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon, label, className, onMouseEnter, onMouseLeave, onFocus, onBlur, ...props }, forwardedRef) => {
    const triggerRef = React.useRef<HTMLButtonElement | null>(null);
    const tooltipRef = React.useRef<HTMLSpanElement>(null);
    const timeoutRef = React.useRef<number | undefined>(undefined);
    const [visible, setVisible] = React.useState(false);
    const [style, setStyle] = React.useState<React.CSSProperties>({});

    const setRefs = React.useCallback(
      (node: HTMLButtonElement | null) => {
        triggerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.RefObject<HTMLButtonElement | null>).current = node;
      },
      [forwardedRef]
    );

    function show() {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setVisible(true), SHOW_DELAY);
    }
    function hide() {
      window.clearTimeout(timeoutRef.current);
      setVisible(false);
    }

    React.useEffect(() => () => window.clearTimeout(timeoutRef.current), []);

    React.useLayoutEffect(() => {
      if (!visible) return;
      const trigger = triggerRef.current;
      const tip = tooltipRef.current;
      if (!trigger || !tip) return;
      const t = trigger.getBoundingClientRect();
      const tw = tip.offsetWidth;
      const th = tip.offsetHeight;
      const placeAbove = t.top >= th + GAP + MARGIN;
      let left = t.left + t.width / 2 - tw / 2;
      left = Math.min(Math.max(left, MARGIN), window.innerWidth - tw - MARGIN);
      const top = placeAbove ? t.top - th - GAP : t.bottom + GAP;
      setStyle({ left, top });
    }, [visible]);

    return (
      <>
        <button
          ref={setRefs}
          aria-label={label}
          onMouseEnter={(e) => {
            show();
            onMouseEnter?.(e);
          }}
          onMouseLeave={(e) => {
            hide();
            onMouseLeave?.(e);
          }}
          onFocus={(e) => {
            show();
            onFocus?.(e);
          }}
          onBlur={(e) => {
            hide();
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
        {visible &&
          createPortal(
            <span
              ref={tooltipRef}
              role="tooltip"
              style={style}
              className="pointer-events-none fixed z-50 whitespace-nowrap rounded-md bg-text px-2 py-1 text-[11.5px] font-medium text-white"
            >
              {label}
            </span>,
            document.body
          )}
      </>
    );
  }
);
IconButton.displayName = "IconButton";

export { IconButton };
