import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useClubData } from "./hooks/useClubData";
import { LoginPage } from "./components/LoginPage";
import { RostersView } from "./components/RostersView";
import { ManagerView } from "./components/ManagerView";
import { ConstraintsView } from "./components/ConstraintsView";
import { GamesView } from "./components/GamesView";
import { WeeklyScheduleView } from "./components/WeeklyScheduleView";
import { CoachView } from "./components/CoachView";
import { IconLogOut, IconEye } from "./components/ui/icons";

const TABS = [
  { id: "rosters", label: "קבוצות, מאמנים ואולמות" },
  { id: "manager", label: "ניהול" },
  { id: "constraints", label: "אילוצים" },
  { id: "games", label: "משחקים" },
  { id: "weekly", label: "לוח שבועי" },
  { id: "coach", label: "תצוגת מאמן" },
];

function Loading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-50">
      <div className="text-stone-400 text-sm">טוען...</div>
    </div>
  );
}

export default function App() {
  const { user, authLoading, authError, signIn, signOut, isFirebaseConfigured } = useAuth();
  const { data, save, loaded, error, isAdmin, mode } = useClubData(user);
  const [tab, setTab] = useState("manager");

  // Cloud mode: wait for auth, then require sign-in.
  if (isFirebaseConfigured && authLoading) return <Loading />;
  if (isFirebaseConfigured && !user) return <LoginPage onSignIn={signIn} authError={authError} />;
  if (!loaded) return <Loading />;

  const canEdit = isAdmin;

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl">
      <div className="max-w-4xl mx-auto px-4 py-6">
        <header className="mb-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-bold text-stone-900 tracking-tight">מערכת שעות אימוני כדורסל</h1>
              <p className="text-sm text-stone-500 mt-0.5">תיאום קבוצות, מאמנים ואולמות במקום אחד</p>
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

        <div className="flex gap-1 bg-stone-200/70 rounded-xl p-1 w-fit mb-5 flex-wrap">
          {TABS.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                tab === tb.id ? "bg-white text-stone-900 shadow-sm" : "text-stone-500 hover:text-stone-700"
              }`}
            >
              {tb.label}
            </button>
          ))}
        </div>

        {error && <div className="mb-4 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5">{error}</div>}

        {tab === "rosters" ? (
          <RostersView data={data} save={save} canEdit={canEdit} />
        ) : tab === "manager" ? (
          <ManagerView data={data} save={save} canEdit={canEdit} />
        ) : tab === "constraints" ? (
          <ConstraintsView data={data} save={save} canEdit={canEdit} />
        ) : tab === "games" ? (
          <GamesView data={data} save={save} canEdit={canEdit} />
        ) : tab === "weekly" ? (
          <WeeklyScheduleView data={data} save={save} canEdit={canEdit} />
        ) : (
          <CoachView data={data} />
        )}
      </div>
    </div>
  );
}
