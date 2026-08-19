import type { ReactNode } from "react";
import { PanelNav } from "./PanelNav";

export function PanelLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PanelNav />
      <main className="mx-auto w-full max-w-[1440px] px-8 py-8">{children}</main>
    </>
  );
}
