import { useState } from "react";
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
import { PageHeader } from "../../components/PageHeader";
import HorariosTab from "./HorariosTab";
import CumplimientoTab from "./CumplimientoTab";
import TurnosPuntualesTab from "./TurnosPuntualesTab";
import InasistenciasTab from "./InasistenciasTab";

type Tab = "horarios" | "puntuales" | "cumplimiento" | "inasistencias";

export default function TurnosPage() {
  const [tab, setTab] = useState<Tab>("horarios");

  return (
    <>
      <PageHeader title="Turnos" />

      <div>
        <Tabs
          value={tab}
          onChange={setTab}
          items={[
            { value: "horarios", label: "Horarios" },
            { value: "puntuales", label: "Turnos puntuales" },
            { value: "cumplimiento", label: "Cumplimiento" },
            { value: "inasistencias", label: "Inasistencias" },
          ]}
        />
      </div>

      {tab === "horarios" && (
        <div {...tabPanelProps("horarios")}>
          <HorariosTab />
        </div>
      )}
      {tab === "puntuales" && (
        <div {...tabPanelProps("puntuales")}>
          <TurnosPuntualesTab />
        </div>
      )}
      {tab === "cumplimiento" && (
        <div {...tabPanelProps("cumplimiento")}>
          <CumplimientoTab />
        </div>
      )}
      {tab === "inasistencias" && (
        <div {...tabPanelProps("inasistencias")}>
          <InasistenciasTab />
        </div>
      )}
    </>
  );
}
