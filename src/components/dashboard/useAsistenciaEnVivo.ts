import { useEffect, useId, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAsistencia } from "../../pages/asistencia/hooks";
import { supabase } from "../../lib/supabase";
import type { AsistenciaRegistro, TipoMarca } from "../../lib/api";

function hoyAR(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" });
}

interface EmpleadoAdentro {
  empleadoId: string;
  empleadoNombre: string;
  desde: string;
}

interface SucursalGrupo {
  sucursalId: string;
  sucursalNombre: string;
  empleados: EmpleadoAdentro[];
}

interface Marca {
  id: string;
  empleadoNombre: string;
  sucursalNombre: string;
  tipo: TipoMarca;
  hora: string;
}

function derivarUltimosMarcados(registros: AsistenciaRegistro[]): Marca[] {
  return [...registros]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 6)
    .map((r) => ({
      id: r.id,
      empleadoNombre: r.empleado_nombre ?? "Empleado",
      sucursalNombre: r.sucursal_nombre ?? "Sin sucursal",
      tipo: r.tipo,
      hora: r.created_at,
    }));
}

function derivarAdentro(registros: AsistenciaRegistro[]): SucursalGrupo[] {
  const ultimoPorEmpleado = new Map<string, AsistenciaRegistro>();
  const ordenados = [...registros].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  for (const r of ordenados) {
    ultimoPorEmpleado.set(r.empleado_id, r);
  }

  const porSucursal = new Map<string, SucursalGrupo>();
  for (const r of ultimoPorEmpleado.values()) {
    if (r.tipo !== "entrada") continue;
    const grupo = porSucursal.get(r.sucursal_id) ?? {
      sucursalId: r.sucursal_id,
      sucursalNombre: r.sucursal_nombre ?? "Sin sucursal",
      empleados: [],
    };
    grupo.empleados.push({
      empleadoId: r.empleado_id,
      empleadoNombre: r.empleado_nombre ?? "Empleado",
      desde: r.created_at,
    });
    porSucursal.set(r.sucursal_id, grupo);
  }
  return Array.from(porSucursal.values());
}

export function useAsistenciaEnVivo(orgId: string) {
  const hoy = hoyAR();
  const { data, isLoading, isError } = useAsistencia(hoy, hoy);
  const queryClient = useQueryClient();
  const [conectado, setConectado] = useState(false);
  const instanceId = useId();

  useEffect(() => {
    const channel = supabase
      .channel(`asistencia-org-${orgId}-${instanceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "asistencia", filter: `org_id=eq.${orgId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["asistencia", hoy, hoy] });
        }
      )
      .subscribe((status) => setConectado(status === "SUBSCRIBED"));

    return () => {
      supabase.removeChannel(channel);
    };
  }, [orgId, hoy, queryClient, instanceId]);

  const porSucursal = useMemo(() => derivarAdentro(data ?? []), [data]);
  const ultimosMarcados = useMemo(() => derivarUltimosMarcados(data ?? []), [data]);

  return { isLoading, isError, porSucursal, conectado, ultimosMarcados };
}
