import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import { ApiError } from "../lib/api";

interface ErrorPlanProps {
  error: Error | null;
  className?: string;
  children?: ReactNode;
}

export function ErrorPlan({ error, className, children }: ErrorPlanProps) {
  if (!error) return null;

  const isApi = error instanceof ApiError;
  const body = isApi ? (error.body as Record<string, unknown> | null) : null;
  const code = isApi ? error.message : null;

  if (code === "limite_plan") {
    const recurso = body?.recurso === "empleados" ? "empleados" : "sucursales";
    const max = body?.max as number | null;
    return (
      <p className={className ?? "text-[15px] text-accent-700"}>
        Llegaste al máximo{max !== null ? ` de ${max}` : ""} {recurso} de tu plan.{" "}
        <Link to="/plan" className="underline underline-offset-2">
          Pasate a un plan superior
        </Link>{" "}
        para sumar más.
      </p>
    );
  }

  if (code === "modulo_no_incluido") {
    const planRequerido = body?.planRequerido === "pro" ? "Pro" : "Básico";
    return (
      <p className={className ?? "text-[15px] text-accent-700"}>
        Este módulo está disponible desde el plan {planRequerido}.{" "}
        <Link to="/plan" className="underline underline-offset-2">
          Ver planes
        </Link>
        .
      </p>
    );
  }

  return <>{children}</>;
}
