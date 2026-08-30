import { useState } from "react";
import { useData } from "./hooks/useData.js";
import ImportView from "./components/ImportView.jsx";
import BuildingsView from "./components/BuildingsView.jsx";
import BuildingPage from "./components/BuildingPage.jsx";
import ProfitabilityDashboard from "./components/ProfitabilityDashboard.jsx";
import DiscrepancyReport from "./components/DiscrepancyReport.jsx";
import { Button } from "./components/ui/Button.jsx";
import { IconBuilding, IconChart, IconWarning } from "./components/ui/icons.jsx";

const TABS = [
  { id: "dashboard", label: "רווחיות", Icon: IconChart },
  { id: "buildings", label: "בניינים", Icon: IconBuilding },
  { id: "findings", label: "ממצאים בגיליון", Icon: IconWarning },
];

export default function App() {
  const store = useData();
  const { data, contractIndex, replaceAll, update, reset, error } = store;
  const [tab, setTab] = useState("dashboard");
  const [openBuildingId, setOpenBuildingId] = useState(null);

  if (!data.buildings.length) return <ImportView onLoad={replaceAll} />;

  const openBuilding = (id) => { setOpenBuildingId(id); setTab("buildings"); };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <IconBuilding className="h-5 w-5 text-slate-500" />
            <span className="font-semibold">ויצמן — ניהול תקציב בניינים</span>
          </div>
          <nav className="flex gap-1">
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                onClick={() => { setTab(id); if (id !== "buildings") setOpenBuildingId(null); }}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  tab === id ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <Icon /> {label}
              </button>
            ))}
          </nav>
          <div className="ms-auto flex items-center gap-2 text-xs text-slate-400">
            <span className="tnum">
              {data.buildings.filter((b) => b.status === "active").length} פעילים
            </span>
            <Button
              onClick={() => {
                if (confirm("לאפס את כל הנתונים בדפדפן הזה ולחזור למסך הייבוא?")) reset();
              }}
            >
              איפוס
            </Button>
          </div>
        </div>
        {error && (
          <div className="bg-red-50 px-4 py-2 text-center text-sm text-red-700">{error}</div>
        )}
      </header>

      <main>
        {tab === "dashboard" && (
          <ProfitabilityDashboard data={data} contractIndex={contractIndex} onOpenBuilding={openBuilding} />
        )}
        {tab === "buildings" &&
          (openBuildingId ? (
            <BuildingPage
              buildingId={openBuildingId}
              data={data}
              contractIndex={contractIndex}
              update={update}
              onBack={() => setOpenBuildingId(null)}
            />
          ) : (
            <BuildingsView data={data} contractIndex={contractIndex} onOpenBuilding={setOpenBuildingId} />
          ))}
        {tab === "findings" && (
          <DiscrepancyReport data={data} contractIndex={contractIndex} onOpenBuilding={openBuilding} />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400">
        הנתונים נשמרים בדפדפן הזה בלבד. אין ענן, אין שליחה החוצה, ואין כניסה ל-git.
      </footer>
    </div>
  );
}
