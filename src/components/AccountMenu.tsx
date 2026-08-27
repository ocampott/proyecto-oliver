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
  const { data: org, isLoading } = useOrgActual();
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

  if (isLoading) {
    return <span className="h-8 w-8 shrink-0 animate-pulse rounded-full bg-text/10" aria-hidden="true" />;
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta"
        className="flex shrink-0 cursor-pointer items-center rounded-full hover:opacity-85"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-[12px] font-bold text-white">
          {org ? iniciales(org.name) : (user?.email?.slice(0, 2).toUpperCase() ?? "?")}
        </span>
      </button>
      {open && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-30 w-[212px] rounded-[10px] border border-border bg-surface-raised p-1.5 shadow-[0_8px_24px_rgba(13,13,17,.1)]">
          <div className="mb-1 border-b border-border px-2.5 pb-2 pt-1">
            {org && <p className="m-0 text-[13.5px] font-bold text-text">{org.name}</p>}
            <p className="m-0 text-[12px] text-text-tertiary">{user?.email}</p>
          </div>
          <button
            onClick={() => {
              setOpen(false);
              navigate("/plan");
            }}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13.5px] font-medium text-text hover:bg-text/[.04]"
          >
            Mi plan
          </button>
          {org?.entitlements.ilimitado && (
            <button
              onClick={() => {
                setOpen(false);
                navigate("/admin");
              }}
              className="flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13.5px] font-medium text-text hover:bg-text/[.04]"
            >
              Panel admin
            </button>
          )}
          <button
            onClick={handleCerrarSesion}
            className="flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-1.5 text-left text-[13.5px] font-medium text-alert hover:bg-text/[.04]"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}
