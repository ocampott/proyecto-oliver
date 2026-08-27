import * as React from "react";
import { createPortal } from "react-dom";

const GAP = 6;
const MARGIN = 8;
const SHOW_DELAY = 300;

interface TriggerProps<T extends HTMLElement> {
  ref: React.RefObject<T | null>;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
}

export function useHoverTooltip<T extends HTMLElement>(label: string, side: "top" | "right" = "top") {
  const triggerRef = React.useRef<T>(null);
  const tooltipRef = React.useRef<HTMLSpanElement>(null);
  const timeoutRef = React.useRef<number | undefined>(undefined);
  const [visible, setVisible] = React.useState(false);
  const [style, setStyle] = React.useState<React.CSSProperties>({});

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

    if (side === "right") {
      const left = Math.min(Math.max(t.right + GAP, MARGIN), window.innerWidth - tw - MARGIN);
      const top = Math.min(Math.max(t.top + t.height / 2 - th / 2, MARGIN), window.innerHeight - th - MARGIN);
      setStyle({ left, top });
      return;
    }

    const placeAbove = t.top >= th + GAP + MARGIN;
    let left = t.left + t.width / 2 - tw / 2;
    left = Math.min(Math.max(left, MARGIN), window.innerWidth - tw - MARGIN);
    const top = placeAbove ? t.top - th - GAP : t.bottom + GAP;
    setStyle({ left, top });
  }, [visible, side]);

  const triggerProps: TriggerProps<T> = {
    ref: triggerRef,
    onMouseEnter: show,
    onMouseLeave: hide,
    onFocus: show,
    onBlur: hide,
  };

  // tooltipNode es un VALOR (React.ReactNode), no un componente — nunca
  // definir una función-componente acá adentro. Una función anidada
  // definida en cada corrida del hook cambia de identidad en cada render,
  // lo que hace que React desmonte/remonte el <span> portaleado en
  // cualquier re-render del componente que llama al hook mientras el
  // tooltip está visible, no solo cuando cambia el estado hover.
  const tooltipNode: React.ReactNode = visible
    ? createPortal(
        <span
          ref={tooltipRef}
          role="tooltip"
          style={style}
          className="pointer-events-none fixed z-50 whitespace-nowrap rounded-[6px] bg-text px-2 py-1 text-[11.5px] font-medium text-white"
        >
          {label}
        </span>,
        document.body
      )
    : null;

  return { triggerProps, tooltipNode };
}
