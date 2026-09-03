import { useState } from "react";
import { useData } from "./hooks/useData.js";
import { useAuth } from "./hooks/useAuth.js";
import SignInScreen from "./components/SignInScreen.jsx";
import ImportView from "./components/ImportView.jsx";
import BuildingsView from "./components/BuildingsView.jsx";
import BuildingPage from "./components/BuildingPage.jsx";
import ProfitabilityDashboard from "./components/ProfitabilityDashboard.jsx";
import DiscrepancyReport from "./components/DiscrepancyReport.jsx";
import InspectionsView from "./components/InspectionsView.jsx";
import VendorsView from "./components/VendorsView.jsx";
import SettingsView from "./components/SettingsView.jsx";
import AssignmentsView from "./components/AssignmentsView.jsx";
import NotesReview from "./components/NotesReview.jsx";
import AsOfBar from "./components/AsOfBar.jsx";
import BackupBar from "./components/BackupBar.jsx";
import { Button } from "./components/ui/Button.jsx";
import { IconBuilding, IconChart, IconWarning, IconShield, IconUsers, IconDatabase, IconCog, IconList, IconNote } from "./components/ui/icons.jsx";
import { todayISO, isISODate } from "./utils/dates.js";

const TABS = [
  { id: "dashboard", label: "רווחיות", Icon: IconChart },
  { id: "buildings", label: "רווחיות לפי בניין", Icon: IconBuilding },
  { id: "assignments", label: "רשימת בניינים", Icon: IconList },
  { id: "inspections", label: "רישום ביקורות", Icon: IconShield },
  { id: "vendors", label: "ספקים", Icon: IconUsers },
  { id: "findings", label: "ממצאים בגיליון", Icon: IconWarning },
  { id: "notes", label: "הערות", Icon: IconNote },
  { id: "settings", label: "ניהול", Icon: IconCog },
  { id: "backup", label: "גיבוי", Icon: IconDatabase },
];

export default function App() {
  const auth = useAuth();
  const store = useData(auth);
  const {
    data, contractIndex, feeIndex, replaceAll, update, add, applyBatch,
    remove, removeMany, reset, uploadLocalToCloud, localSnapshot,
    cloud, loading, saving, error,
  } = store;
  const [tab, setTab] = useState("dashboard");
  const [openBuildingId, setOpenBuildingId] = useState(null);
  const [asOf, setAsOf] = useState(todayISO);

  /**
   * צפייה בתאריך שאינו היום היא **קריאה בלבד**.
   *
   * לא מגבלה טכנית אלא הכרעה: העורך בוחר את הרשומה התקפה לפי `asOf`, ולכן
   * עריכה במצב היסטורי הייתה משנה את המחיר של יוני בזמן שהמשתמש חושב שהוא
   * מתקן את היום. חסימה מפורשת עם דרך חזרה ברורה עדיפה על פעולה שמצליחה
   * ועושה משהו אחר ממה שנראה.
   */
  const isHistorical = isISODate(asOf) && asOf !== todayISO();

  // --- שער הכניסה: רלוונטי רק כשיש ענן. במצב מקומי אין למי להתחבר. ---
  if (auth.cloud && !auth.allowed) {
    const state = !auth.authReady || (auth.user && !auth.membersLoaded)
      ? "loading"
      : auth.user ? "denied" : "signedOut";
    return (
      <SignInScreen
        state={state}
        email={auth.email}
        onSignIn={auth.signIn}
        onSignOut={auth.signOut}
        error={auth.error}
        localFileWarning={auth.localFileWarning}
      />
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        טוען את הנתונים מהענן…
      </div>
    );
  }

  /**
   * ⚠ במצב ענן, מסד ריק אינו בהכרח "צריך לייבא" — הוא יכול להיות גם "יש
   * נתונים מקומיים שטרם הועלו". `ImportView` מקבל את שני המסלולים כדי
   * שרונן לא ייאלץ לגרור שוב אקסל שכבר ייבא.
   */
  const pendingLocal = cloud ? localSnapshot().buildings.length : 0;

  if (!data.buildings.length) {
    return (
      <ImportView
        onLoad={replaceAll}
        pendingLocal={pendingLocal}
        onUploadLocal={uploadLocalToCloud}
      />
    );
  }

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
            {cloud ? (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-1 text-emerald-700"
                title={`מחובר כ-${auth.email} · השינויים מסתנכרנים לכל הצוות`}>
                <span className={`h-1.5 w-1.5 rounded-full ${saving ? "bg-amber-500" : "bg-emerald-500"}`} />
                {saving ? "שומר…" : "ענן"}
              </span>
            ) : (
              <span className="rounded bg-slate-100 px-2 py-1 text-slate-500"
                title="הנתונים בדפדפן הזה בלבד. הגדרת .env תעביר לענן.">
                מקומי
              </span>
            )}
            <Button
              onClick={() => {
                const where = cloud ? "בענן, לכל הצוות" : "בדפדפן הזה";
                if (confirm(`לאפס את כל הנתונים ${where} ולחזור למסך הייבוא?`)) reset();
              }}
            >
              איפוס
            </Button>
            {cloud && (
              <Button onClick={auth.signOut} title={auth.email}>יציאה</Button>
            )}
          </div>
        </div>
        {error && (
          <div className="bg-red-50 px-4 py-2 text-center text-sm text-red-700">{error}</div>
        )}
        <AsOfBar asOf={asOf} onChange={(v) => setAsOf(isISODate(v) ? v : todayISO())} isHistorical={isHistorical} />
      </header>

      <main>
        {tab === "dashboard" && (
          <ProfitabilityDashboard
            data={data}
            contractIndex={contractIndex}
            feeIndex={feeIndex}
            asOf={asOf}
            onOpenBuilding={openBuilding}
            onOpenTab={setTab}
          />
        )}
        {tab === "inspections" && (
          <InspectionsView data={data} applyBatch={applyBatch} asOf={asOf} readOnly={isHistorical} onOpenBuilding={openBuilding} />
        )}
        {tab === "vendors" && (
          <VendorsView data={data} contractIndex={contractIndex} feeIndex={feeIndex} asOf={asOf} onOpenBuilding={openBuilding} />
        )}
        {tab === "buildings" &&
          (openBuildingId ? (
            <BuildingPage
              buildingId={openBuildingId}
              data={data}
              contractIndex={contractIndex}
              feeIndex={feeIndex}
              asOf={asOf}
              readOnly={isHistorical}
              update={update}
              add={add}
              applyBatch={applyBatch}
              remove={remove}
              removeMany={removeMany}
              onBack={() => setOpenBuildingId(null)}
            />
          ) : (
            <BuildingsView
              data={data}
              contractIndex={contractIndex}
              feeIndex={feeIndex}
              asOf={asOf}
              readOnly={isHistorical}
              add={add}
              update={update}
              onOpenBuilding={setOpenBuildingId}
            />
          ))}
        {tab === "assignments" && (
          <AssignmentsView
            data={data}
            contractIndex={contractIndex}
            feeIndex={feeIndex}
            asOf={asOf}
            readOnly={isHistorical}
            update={update}
            applyBatch={applyBatch}
            onOpenBuilding={openBuilding}
          />
        )}
        {tab === "notes" && (
          <NotesReview
            data={data}
            readOnly={isHistorical}
            update={update}
            remove={remove}
            applyBatch={applyBatch}
            onOpenBuilding={openBuilding}
          />
        )}
        {tab === "settings" && (
          <SettingsView
            data={data}
            contractIndex={contractIndex}
            asOf={asOf}
            readOnly={isHistorical}
            update={update}
            add={add}
            remove={remove}
            auth={auth}
          />
        )}
        {tab === "backup" && (
          <BackupBar data={data} asOf={asOf} onRestore={replaceAll} />
        )}
        {tab === "findings" && (
          <DiscrepancyReport data={data} contractIndex={contractIndex} feeIndex={feeIndex} asOf={asOf} onOpenBuilding={openBuilding} />
        )}
      </main>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-center text-xs text-slate-400">
        {cloud
          ? `מחובר כ-${auth.email}. הנתונים בענן ומשותפים לכל חברי הצוות.`
          : "הנתונים נשמרים בדפדפן הזה בלבד. אין ענן, אין שליחה החוצה, ואין כניסה ל-git."}
      </footer>
    </div>
  );
}
