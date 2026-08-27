import * as React from "react";
import { cn } from "../../lib/utils";

function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/);
  return `${partes[0]?.[0] ?? ""}${partes[1]?.[0] ?? ""}`.toUpperCase();
}

export interface AvatarProps {
  nombre: string;
  size?: "sm" | "md";
  className?: string;
}

function Avatar({ nombre, size = "md", className }: AvatarProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-[6px] bg-accent-100 font-semibold text-accent-800",
        size === "sm" ? "h-5 w-5 text-[9px]" : "h-6 w-6 text-[10px]",
        className
      )}
    >
      {iniciales(nombre)}
    </span>
  );
}

export interface PersonCellProps {
  nombre: string;
  meta?: React.ReactNode;
  size?: "sm" | "md";
}

function PersonCell({ nombre, meta, size = "md" }: PersonCellProps) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar nombre={nombre} size={size} />
      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-text">{nombre}</span>
        {meta && <span className="block truncate text-[11.5px] text-text-tertiary">{meta}</span>}
      </span>
    </span>
  );
}

export { Avatar, PersonCell };
