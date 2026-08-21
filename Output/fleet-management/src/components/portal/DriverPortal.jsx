import { useState } from "react";
import { Car, Gauge, LogOut } from "lucide-react";
import { useI18n } from "../../hooks/useI18n.jsx";
import MyVehicleScreen from "./MyVehicleScreen.jsx";
import OdometerReportScreen from "./OdometerReportScreen.jsx";

// ============================================================================
// DriverPortal — המעטפת. **שני מסכים, לא אפליקציה.**
//
// זה נפתח בטלפון, ולכן: ניווט תחתון בשתי לשוניות בגודל אצבע, כותרת אחת
// (`h1` יחיד — מבנה כותרות תקין), ואפס טבלאות. אין תפריט המבורגר, אין
// דשבורד, ואין שום דבר שאפשר להיכנס אליו ולא למצוא את הדרך חזרה.
//
// ⚠️ אין כאן קנסות, תקלות, טיפולים או נהגים אחרים — וזו לא "פרוסה חלקית"
// אלא בקרה: 5.3.2 בהכוונת עדי — כשהאישור הוא חשבון גימייל פרטי שהחברה לא
// הנפיקה ולא יכולה לכבות, **רדיוס הפגיעה המינימלי הוא מה שמחליף את השליטה
// בחשבון.** כל הרחבה = סקירה מחדש.
// ============================================================================
const TABS = [
  { id: "vehicle", labelKey: "portal.myVehicle", Icon: Car },
  { id: "report", labelKey: "portal.reportKm", Icon: Gauge },
];

export function DriverPortal({ driver, entry, readings, onSubmitReading, onSignOut, contact }) {
  const { t, toggleLang } = useI18n();
  const [tab, setTab] = useState("report");

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-md items-center gap-2 px-4 py-3">
          <span className="flex h-8 w-8 items-center justify-center rounded bg-brand-600 text-white">
            <Car size={17} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-sm font-semibold text-slate-900">{t("portal.title")}</h1>
            <p className="truncate text-xs text-slate-600">{driver?.fullName || "—"}</p>
          </div>
          <button
            type="button"
            onClick={toggleLang}
            className="rounded px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            {t("nav.language")}
          </button>
          <button
            type="button"
            onClick={onSignOut}
            aria-label={t("nav.signOut")}
            className="flex h-9 w-9 items-center justify-center rounded text-slate-600 hover:bg-slate-100 hover:text-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <LogOut size={17} aria-hidden="true" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-4">
        {tab === "vehicle" && <MyVehicleScreen entry={entry} driver={driver} contact={contact} />}
        {tab === "report" && (
          <OdometerReportScreen entry={entry} readings={readings} onSubmit={onSubmitReading} />
        )}
      </main>

      {/* ניווט תחתון — יעדי מגע גדולים, בהישג האגודל. `aria-current` ולא
          צבע בלבד: הלשונית הפעילה חייבת להיות מוכרזת, לא רק נראית. */}
      <nav
        aria-label={t("portal.nav")}
        className="fixed inset-x-0 bottom-0 border-t border-slate-200 bg-white"
      >
        <ul className="mx-auto flex max-w-md">
          {TABS.map(({ id, labelKey, Icon }) => {
            const active = tab === id;
            return (
              <li key={id} className="flex-1">
                <button
                  type="button"
                  onClick={() => setTab(id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-[56px] w-full flex-col items-center justify-center gap-0.5 text-xs font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-500 ${
                    active ? "text-brand-700" : "text-slate-600"
                  }`}
                >
                  <Icon size={20} aria-hidden="true" />
                  {t(labelKey)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

export default DriverPortal;
