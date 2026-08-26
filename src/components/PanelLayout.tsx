import { useState, type ReactNode } from "react";
import { TopBar } from "./TopBar";
import { Sidebar } from "./Sidebar";

export function PanelLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <TopBar onMenuClick={() => setMobileOpen(true)} />
      <div className="flex min-h-0 flex-1">
        <Sidebar mobileOpen={mobileOpen} onMobileClose={() => setMobileOpen(false)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1560px] px-5 py-7 sm:px-8 md:px-12 md:py-12">{children}</div>
        </main>
      </div>
    </div>
  );
}
