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
          <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 md:px-10 md:py-10">{children}</div>
        </main>
      </div>
    </div>
  );
}
