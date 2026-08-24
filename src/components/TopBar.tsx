import { Menu } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { NotificationBell } from "./NotificationBell";
import { IconButton } from "./ui/icon-button";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="z-20 flex items-center bg-white/90 px-4 py-3.5 shadow-[0_1px_0_rgba(24,24,27,0.07)] backdrop-blur-sm md:px-6">
      <IconButton
        className="mr-2 md:hidden"
        onClick={onMenuClick}
        label="Abrir menú"
        icon={<Menu className="h-[18px] w-[18px]" />}
      />
      <span className="text-[17px] font-extrabold tracking-tight text-text">oliver</span>
      <div className="ml-auto flex items-center gap-2">
        <NotificationBell />
        <AccountMenu />
      </div>
    </header>
  );
}
