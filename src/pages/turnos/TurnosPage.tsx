import { useState } from "react";
import { Tabs, tabPanelProps } from "../../components/ui/tabs";
import { PageHeader } from "../../components/PageHeader";
import HorariosTab from "./HorariosTab";
import CumplimientoTab from "./CumplimientoTab";

type Tab = "horarios" | "cumplimiento";

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
            { value: "cumplimiento", label: "Cumplimiento" },
          ]}
        />
      </div>

      {tab === "horarios" ? (
        <div {...tabPanelProps("horarios")}>
          <HorariosTab />
        </div>
      ) : (
        <div {...tabPanelProps("cumplimiento")}>
          <CumplimientoTab />
        </div>
      )}
    </>
  );
}
