import { useEffect, useRef } from "react";

/** Native inert/top layer, with an explicit keyboard loop (no jump to browser chrome). */
export function useModal(open: boolean) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!open || !dialog) return;
    const previous = document.activeElement;
    dialog.showModal();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || (event.target instanceof Element && event.target.closest("dialog") !== dialog)) return;
      const elements = [...dialog.querySelectorAll<HTMLElement>(
        'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]'
      )].filter((el) => el.tabIndex >= 0 && el.getClientRects().length > 0);
      const first = elements[0];
      const last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener("keydown", handleKey);
    return () => {
      dialog.removeEventListener("keydown", handleKey);
      dialog.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [open]);
  return ref;
}
