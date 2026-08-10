import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useClubData } from "./hooks/useClubData";
import { todayWeekStart } from "./utils/dates";
import { LoginPage } from "./components/LoginPage";
import { RostersView } from "./components/RostersView";
import { ManagerView } from "./components/ManagerView";
import { ConstraintsView } from "./components/ConstraintsView";
import { GamesView } from "./components/GamesView";
import { WeeklyScheduleView } from "./components/WeeklyScheduleView";
import { CoachView } from "./components/CoachView";
import { PlayersView } from "./components/PlayersView";
import { ReportView } from "./components/ReportView";
import { AnnouncementsView } from "./components/AnnouncementsView";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { BirthdayReminder } from "./components/BirthdayReminder";
import { SchedulePublishedBanner } from "./components/SchedulePublishedBanner";
import { LegalFooter } from "./legal/LegalFooter";
import { IconLogOut, IconEye } from "./components/ui/icons";
import clubLogo from "./assets/club-logo.jpg";

const TABS = [
  { id: "announcements", label: "הודעות" },
  { id: "rosters", label: "קבוצות, מאמנים ואולמות" },
  { id: "manager", label: "ניהול" },
  { id: "constraints", label: "אילוצים" },
  { id: "games", label: "משחקים" },
  { id: "weekly", label: "לוח שבועי" },
  { id: "coach", label: "תצוגת מאמן" },
  { id: "players", label: "שחקנים" },
  { id: "report", label: "דו\"ח שעות" },
];

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-stone-600 text-sm">טוען...</div>
    </div>
  );
}

export default function App() {
  const { user, authLoading, authError, signIn, signOut, isFirebaseConfigured } = useAuth();
  const { data, save, loaded, error, isAdmin, mode } = useClubData(user);
  const [tab, setTab] = useState("manager");
  const [weekStart, setWeekStart] = useState(todayWeekStart());

  // Cloud mode: wait for auth, then require sign-in.
  if (isFirebaseConfigured && authLoading) return <Loading />;
  if (isFirebaseConfigured && !user) return <LoginPage onSignIn={signIn} authError={authError} />;
  if (!loaded) return <Loading />;

  const canEdit = isAdmin;

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl">
      {/* Club identity accent: royal-blue bar with a short orange segment, echoing the logo (blue ribbon + orange stars). */}
      <div className="h-1.5 bg-brand-600 flex" aria-hidden="true">
        <span className="h-full w-24 bg-accent-500" />
      </div>
      <div className={`${tab === "weekly" ? "max-w-7xl" : "max-w-4xl"} mx-auto px-4 py-6`}>
        <header className="mb-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <img src={clubLogo} alt="עירוני קריית אונו – כדורסל דור העתיד" className="w-14 h-14 object-contain shrink-0" />
              <div>
                <h1 className="text-2xl font-bold text-brand-700 tracking-tight">מערכת שעות אימוני כדורסל</h1>
                <p className="text-sm text-stone-500 mt-0.5">תיאום קבוצות, מאמנים ואולמות במקום אחד</p>
              </div>
            </div>
            {isFirebaseConfigured && user && (
              <div className="flex items-center gap-2 text-xs text-stone-500">
                <span className="hidden sm:inline">{user.displayName || user.email}</span>
                <button onClick={signOut} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-50 text-stone-600">
                  <IconLogOut size={13} /> יציאה
                </button>
              </div>
            )}
          </div>

          {mode === "local" && (
            <p className="text-xs text-amber-600 mt-1">
              ⚠ מצב מקומי: הנתונים נשמרים בדפדפן הזה בלבד, ולא משותפים אוטומטית עם מכשירים אחרים. חבר את Firebase כדי לעבור לסנכרון בענן (ראה README).
            </p>
          )}
          {mode === "cloud" && !canEdit && (
            <p className="text-xs text-blue-700 mt-1 flex items-center gap-1">
              <IconEye size={13} /> מצב צפייה בלבד — רק מנהל יכול לערוך. אם אתה אמור להיות מנהל, פנה למי שמנהל את הרשימה.
            </p>
          )}
        </header>

        <div role="tablist" aria-label="מסכי המערכת" className="flex gap-1 bg-stone-200/70 rounded-xl p-1 w-fit mb-5 flex-wrap">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              role="tab"
              id={`tab-${tb.id}`}
              aria-selected={tab === tb.id}
              aria-controls="tabpanel"
              onClick={() => setTab(tb.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === tb.id ? "bg-brand-600 text-white shadow-sm" : "text-stone-600 hover:text-stone-800"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5">{error}</div>}

        <SchedulePublishedBanner data={data} />
        {tab !== "announcements" && (
          <>
            <AnnouncementBanner data={data} onOpen={() => setTab("announcements")} />
            {/* Alongside the notice rather than inside it: coaches live on the board and the
                coach view, and a birthday nobody sees until they open the notices tab is a
                birthday nobody wished. Hidden on the notices tab, which shows the full list. */}
            <BirthdayReminder coaches={data.coaches} weekStart={weekStart} compact />
          </>
        )}

        <div id="tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "announcements" ? (
          <AnnouncementsView data={data} save={save} canEdit={canEdit} weekStart={weekStart} />
        ) : tab === "rosters" ? (
          <RostersView data={data} save={save} canEdit={canEdit} />
        ) : tab === "manager" ? (
          <ManagerView data={data} save={save} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : tab === "constraints" ? (
          <ConstraintsView data={data} save={save} canEdit={canEdit} />
        ) : tab === "games" ? (
          <GamesView data={data} save={save} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : tab === "weekly" ? (
          <WeeklyScheduleView data={data} save={save} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : tab === "coach" ? (
          <CoachView data={data} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : tab === "players" ? (
          <PlayersView data={data} save={save} canEdit={canEdit} />
        ) : (
          <ReportView data={data} />
        )}
        </div>

        <LegalFooter className="mt-10 pt-6 border-t border-stone-200" />
      </div>
    </div>
  );
}
