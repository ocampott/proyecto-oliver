import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useOrgActual } from "../lib/hooks";
import { supabase } from "../lib/supabase";

function iniciales(nombre: string): string {
  const palabras = nombre.trim().split(/\s+/);
  if (palabras.length === 1) return palabras[0].slice(0, 2).toUpperCase();
  return (palabras[0][0] + palabras[palabras.length - 1][0]).toUpperCase();
}

export function AccountMenu() {
  const { user } = useAuth();
  const { data: org } = useOrgActual();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  React.useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  async function handleCerrarSesion() {
    await supabase.auth.signOut();
    navigate("/login", { replace: true });
  }

  if (!org) return null;

  return (
    <div ref={ref} className="relative ml-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white"
      >
        {iniciales(org.name)}
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+12px)] w-[232px] rounded-[14px] border border-[--color-border-soft] bg-white p-2 shadow-[0_16px_40px_rgba(24,24,27,.18),0_3px_10px_rgba(24,24,27,.06)]">
          <div className="mb-1.5 border-b border-[--color-border-soft] px-3 pb-3 pt-2.5">
            <p className="m-0 text-[13.5px] font-bold text-text">{org.name}</p>
            <p className="m-0.5 text-[12px] text-text-tertiary">{user?.email}</p>
          </div>
          <button
            disabled
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium text-text disabled:opacity-45"
          >
            Configuración
          </button>
          <button
            onClick={handleCerrarSesion}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13.5px] font-medium text-[--color-alert] hover:bg-black/[.03]"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
