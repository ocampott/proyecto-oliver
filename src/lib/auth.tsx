import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  // Arranca en "no inicializado" (no en null) para no confundir la carga
  // inicial de sesión con un logout real y disparar un clear() de más.
  const userIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        userIdRef.current = data.session?.user.id ?? null;
        setSession(data.session);
      })
      .catch(() => setSession(null))
      .finally(() => setLoading(false));

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      const newUserId = newSession?.user.id ?? null;
      // Se cambió de usuario (login con otra cuenta) o se cerró sesión:
      // hay que tirar todo lo cacheado en React Query (org, empleados,
      // sucursales, etc.) para que no se siga mostrando data de la cuenta
      // anterior. Un simple TOKEN_REFRESHED del mismo usuario no dispara esto.
      if (userIdRef.current !== undefined && newUserId !== userIdRef.current) {
        queryClient.clear();
      }
      userIdRef.current = newUserId;
      setSession(newSession);
    });

    return () => listener.subscription.unsubscribe();
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
