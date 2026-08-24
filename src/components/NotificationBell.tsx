import { Bell } from "lucide-react";
import { IconButton } from "./ui/icon-button";

// Placeholder visual — sin dropdown ni contador todavía.
// Se completa cuando se implemente el spec de notificaciones.
export function NotificationBell() {
  return <IconButton icon={<Bell className="h-[18px] w-[18px]" />} label="Notificaciones" />;
}
