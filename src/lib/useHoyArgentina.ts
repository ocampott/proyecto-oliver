import { useEffect, useState } from "react";
const hoy = () => new Date().toLocaleDateString("sv", { timeZone: "America/Argentina/Buenos_Aires" });
/** Actualiza también al volver a una pestaña suspendida o cruzar medianoche. */
export function useHoyArgentina() {
  const [fecha, setFecha] = useState(hoy);
  useEffect(() => {
    const actualizar = () => setFecha(hoy());
    const timer = window.setInterval(actualizar, 30_000);
    document.addEventListener("visibilitychange", actualizar);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", actualizar); };
  }, []);
  return fecha;
}
