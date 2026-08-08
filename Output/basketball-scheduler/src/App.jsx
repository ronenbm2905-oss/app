import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { useClubData } from "./hooks/useClubData";
import { todayWeekStart } from "./utils/dates";
import { applyTheme } from "./utils/theme";
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
import { SettingsView } from "./components/SettingsView";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { SchedulePublishedBanner } from "./components/SchedulePublishedBanner";
import { LegalFooter } from "./legal/LegalFooter";
import { IconLogOut, IconEye } from "./components/ui/icons";
import { clubName as clubNameOf } from "./utils/club";
import { clubLogoSrc } from "./utils/clubLogo";

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
  { id: "settings", label: "הגדרות" },
];

// Tabs a view-only user never sees at all (not merely read-only).
const ADMIN_ONLY_TABS = new Set(["settings"]);

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-stone-600 text-sm">טוען...</div>
    </div>
  );
}

function ClubNotFound({ clubId }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50 px-4" dir="rtl">
      <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-8 max-w-sm w-full text-center space-y-3">
        <h1 className="text-lg font-bold text-stone-900">המועדון לא נמצא</h1>
        <p className="text-sm text-stone-600 leading-relaxed">
          לא קיים מועדון בשם{" "}
          <span dir="ltr" className="font-mono text-xs bg-stone-100 px-1 py-0.5 rounded">{clubId}</span>.
          אם זו מערכת חדשה שטרם הוקמה — פנה למי שמנהל את השירות.
        </p>
      </div>
    </div>
  );
}

export default function App({ clubId }) {
  const { user, authLoading, authError, signIn, signOut, isFirebaseConfigured } = useAuth();
  const { data, save, publish, syncJoinCode, loaded, error, isAdmin, mode, missing } = useClubData(user, clubId);
  const [tab, setTab] = useState("manager");
  // "" for a club that has not uploaded a logo — see utils/clubLogo.
  const clubLogo = clubLogoSrc(data);
  const [weekStart, setWeekStart] = useState(todayWeekStart());

  // Paint the club's identity. Must run before the early returns below so the hook
  // order stays stable; applyTheme is a no-op write when the colors haven't changed.
  //
  // The NAME waits until the club document has actually been read. Until then `settings`
  // is DEFAULT_SETTINGS, whose name belongs to the original club — writing it to the tab
  // title put "קרית אונו – דור העתיד" above every other club's login screen.
  const settings = data.settings;
  const identityKnown = (!isFirebaseConfigured || Boolean(user)) && loaded && !error;
  useEffect(() => {
    applyTheme(settings);
    if (identityKnown && settings?.name) document.title = settings.name;
  }, [settings?.primaryColor, settings?.accentColor, settings?.name, identityKnown]);

  // Cloud mode: wait for auth, then require sign-in.
  if (isFirebaseConfigured && authLoading) return <Loading />;
  if (isFirebaseConfigured && !user) return <LoginPage onSignIn={signIn} authError={authError} />;
  if (!loaded) return <Loading />;
  // A signed-in user reaching a club that was never set up would otherwise land in an
  // empty, fully-editable-looking app and start entering data that nobody can read.
  if (missing) return <ClubNotFound clubId={clubId} />;

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
              {clubLogo && (
                <img src={clubLogo} alt={clubNameOf(data)} className="w-14 h-14 object-contain shrink-0" />
              )}
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
          {TABS.filter((tb) => canEdit || !ADMIN_ONLY_TABS.has(tb.id)).map((tb) => (
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
        {tab !== "announcements" && <AnnouncementBanner data={data} onOpen={() => setTab("announcements")} />}

        <div id="tabpanel" role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === "announcements" ? (
          <AnnouncementsView data={data} save={save} canEdit={canEdit} />
        ) : tab === "rosters" ? (
          <RostersView data={data} save={save} canEdit={canEdit} />
        ) : tab === "manager" ? (
          <ManagerView data={data} save={save} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : tab === "constraints" ? (
          <ConstraintsView data={data} save={save} canEdit={canEdit} />
        ) : tab === "games" ? (
          <GamesView data={data} save={save} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : tab === "weekly" ? (
          <WeeklyScheduleView data={data} save={save} publish={publish} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : tab === "coach" ? (
          <CoachView data={data} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : tab === "players" ? (
          <PlayersView data={data} save={save} canEdit={canEdit} />
        ) : tab === "settings" ? (
          <SettingsView data={data} save={save} canEdit={canEdit} syncJoinCode={syncJoinCode} clubId={clubId} />
        ) : (
          <ReportView data={data} />
        )}
        </div>

        <LegalFooter className="mt-10 pt-6 border-t border-stone-200" data={data} />
      </div>
    </div>
  );
}
