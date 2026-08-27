import { useEffect, useState, type ReactNode } from "react";
import { MobileHeader } from "./MobileHeader";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";

export function PanelLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
        onOpenSearch={() => setPaletteOpen(true)}
      />
      <div className="flex min-h-0 flex-1 flex-col">
        <MobileHeader onMenuClick={() => setMobileOpen(true)} onSearchClick={() => setPaletteOpen(true)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1440px] px-6 py-8 md:px-10 md:py-10">{children}</div>
        </main>
      </div>
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
