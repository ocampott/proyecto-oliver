import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { PasswordField } from "../components/ui/password-field";
import { Card } from "../components/ui/card";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";

export default function SetPasswordPage() {
  const navigate = useNavigate();
  const { session, loading } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("La contraseña tiene que tener al menos 6 caracteres.");
      return;
    }
    if (password !== confirmar) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setGuardando(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setGuardando(false);
    if (updateError) {
      setError("No se pudo guardar la contraseña. Probá de nuevo.");
      return;
    }
    navigate("/", { replace: true });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8">
        <div
          className="h-8 w-8 animate-spin rounded-full border-[3px] border-text/15 border-t-accent"
          role="status"
          aria-label="Cargando"
        />
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-bg p-8">
        <Card className="w-full max-w-sm border-2 border-divider p-8 text-center">
          <h1 className="text-[20px] font-extrabold text-text">Este enlace no es válido</h1>
          <p className="mt-2 text-[15px] text-text/60">
            El link de invitación ya se usó o venció. Pedile a quien te invitó que te mande uno nuevo.
          </p>
        </Card>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-8">
      <Card className="w-full max-w-sm border-2 border-divider p-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          <h1 className="text-[20px] font-extrabold text-text">Elegí tu contraseña</h1>
          <p className="text-[15px] text-text/60">
            Ya podés entrar con {session.user.email}. Elegí una contraseña para tu cuenta.
          </p>
          <PasswordField
            label="Contraseña"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordField
            label="Confirmar contraseña"
            required
            autoComplete="new-password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
          />
          {error && <p className="text-[15px] text-accent-700">{error}</p>}
          <Button type="submit" variant="primary" size="lg" disabled={guardando}>
            {guardando ? "Guardando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
