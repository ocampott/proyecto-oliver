import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button } from "../components/ui/button";
import { Field } from "../components/ui/field";
import { PasswordField } from "../components/ui/password-field";
import { Card } from "../components/ui/card";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    // Evita que un Enter durante la composición de un IME (japonés, chino,
    // etc.) dispare el submit antes de que el usuario termine de tipear.
    if ((e.nativeEvent as KeyboardEvent).isComposing || (e as unknown as KeyboardEvent).keyCode === 229) return;
    setLoading(true);
    setError(null);

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    setLoading(false);
    if (signInError) {
      setError("Email o contraseña incorrectos.");
      return;
    }
    const from = (location.state as { from?: Location } | null)?.from?.pathname ?? "/";
    navigate(from, { replace: true });
  }

  return (
    <main className="grid min-h-screen bg-bg md:grid-cols-[minmax(280px,0.8fr)_minmax(380px,1.2fr)]">
      <section className="hidden flex-col justify-between bg-accent p-10 text-surface-raised md:flex">
        <div className="text-[22px] font-bold tracking-[-0.03em]">
          oliver<span className="text-accent-300">.</span>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent-200">Control de asistencia</p>
          <p className="mt-4 max-w-xs text-3xl font-semibold leading-tight tracking-[-0.03em]">
            El pulso de tu equipo, sin ruido.
          </p>
        </div>
        <p className="font-mono text-xs text-surface-raised/50">oliver / 2026</p>
      </section>

      <section className="flex items-center justify-center p-6 md:p-12">
        <Card className="w-full max-w-md border-0 bg-transparent shadow-none">
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="mb-4">
              <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Bienvenido</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.02em] text-text">Iniciar sesión</h1>
              <p className="mt-3 text-sm text-text-secondary">Ingresá para ver el estado de tu organización.</p>
            </div>
            <Field
              label="Email"
              type="email"
              required
              autoComplete="email"
              placeholder="tu@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <PasswordField
              label="Contraseña"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-alert">
                {error}
              </p>
            )}
            <Button type="submit" variant="primary" size="lg" disabled={loading} className="mt-2">
              {loading ? "Entrando..." : "Entrar"}
            </Button>
          </form>
        </Card>
      </section>
    </main>
  );
}
