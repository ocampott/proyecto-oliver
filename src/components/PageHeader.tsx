import { useEffect, useSyncExternalStore, type ReactNode } from "react";

export interface PageHeaderBreadcrumb {
  label: string;
  href?: string;
}

export interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  breadcrumb?: PageHeaderBreadcrumb[];
}

/**
 * Store del "cromo" de página (título, subtítulo, acciones). La página lo
 * publica vía <PageHeader/> y la Topbar lo consume con usePageChrome(). Es un
 * store externo y no un contexto para no re-renderizar al árbol de la página
 * cuando la Topbar cambia.
 */
type PageChrome = Omit<PageHeaderProps, "title"> & { title?: ReactNode };

let chrome: PageChrome = {};
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function setPageChrome(next: PageChrome) {
  chrome = next;
  emit();
}

function clearPageChrome() {
  chrome = {};
  emit();
}

export function usePageChrome(): PageChrome {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => chrome,
    () => chrome,
  );
}

/**
 * Ya no dibuja nada en el flujo de la página: publica su contenido a la Topbar,
 * que es el único encabezado del panel.
 */
export function PageHeader({ title, description, meta, actions, breadcrumb }: PageHeaderProps) {
  // Empuja el contenido más reciente en cada render. Sin array de deps porque
  // title/actions/meta suelen ser JSX nuevo en cada render; comparar no aporta.
  // ponytail: re-renderiza la Topbar en cada render de la página. Si aparece en
  // un profile, agregar un shallow-compare acá.
  useEffect(() => {
    setPageChrome({ title, description, meta, actions, breadcrumb });
  });

  // Limpia sólo al desmontar la página.
  useEffect(() => clearPageChrome, []);

  return null;
}
