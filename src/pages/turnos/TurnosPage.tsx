import { useState } from "react";
import { Button } from "../../components/ui/button";
import HorariosTab from "./HorariosTab";
import CumplimientoTab from "./CumplimientoTab";

type Tab = "horarios" | "cumplimiento";

export default function TurnosPage() {
  const [tab, setTab] = useState<Tab>("horarios");

  return (
    <>
      <h1 className="text-[32px] font-extrabold text-text">Turnos</h1>

      <div className="mt-4 flex gap-2" role="tablist">
        <Button
          role="tab"
          aria-selected={tab === "horarios"}
          variant={tab === "horarios" ? "primary" : "secondary"}
          onClick={() => setTab("horarios")}
        >
          Horarios
        </Button>
        <Button
          role="tab"
          aria-selected={tab === "cumplimiento"}
          variant={tab === "cumplimiento" ? "primary" : "secondary"}
          onClick={() => setTab("cumplimiento")}
        >
          Cumplimiento
        </Button>
      </div>

      {tab === "horarios" ? <HorariosTab /> : <CumplimientoTab />}
    </>
  );
}
