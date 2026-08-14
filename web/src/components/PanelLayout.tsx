import type { ReactNode } from "react";
import { PanelNav } from "./PanelNav";

export function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PanelNav />
      {children}
    </>
  );
}
