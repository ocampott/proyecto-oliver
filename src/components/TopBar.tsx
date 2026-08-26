import { Menu } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { NotificationBell } from "./NotificationBell";
import { IconButton } from "./ui/icon-button";

export function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="z-20 flex items-center border-b border-border-soft bg-surface px-4 py-3.5 shadow-none md:px-6">
      <IconButton
        className="mr-2 md:hidden"
        onClick={onMenuClick}
        label="Abrir menú"
        icon={<Menu className="h-[18px] w-[18px]" />}
      />
      <span className="text-[17px] font-bold tracking-tight text-text">oliver</span>
      <div className="ml-auto flex items-center gap-4">
        <NotificationBell />
        <AccountMenu />
      </div>
    </header>
  );
}
