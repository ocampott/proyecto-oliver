import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { isSupabaseConfigured } from "../lib/supabase";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  // The preview can showcase the authenticated UI before Supabase variables
  // are mounted. This branch is disabled automatically in configured builds.
  if (!isSupabaseConfigured) return <>{children}</>;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg">
        <div
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-text/15 border-t-accent"
          role="status"
          aria-label="Cargando"
        />
      </main>
    );
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
