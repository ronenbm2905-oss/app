import { useState, useEffect } from "react";
import { useAuth } from "./hooks/useAuth";
import { useClubData } from "./hooks/useClubData";
import { todayWeekStart } from "./utils/dates";
import { applyTheme } from "./utils/theme";
import { visibleTabsFor, resolveActiveTab } from "./utils/tabs";
import { LoginPage } from "./components/LoginPage";
import { RostersView } from "./components/RostersView";
import { ManagerView } from "./components/ManagerView";
import { ConstraintsView } from "./components/ConstraintsView";
import { AvailabilityView } from "./components/AvailabilityView";
import { GamesView } from "./components/GamesView";
import { WeeklyScheduleView } from "./components/WeeklyScheduleView";
import { CoachView } from "./components/CoachView";
import { PlayersView } from "./components/PlayersView";
import { ReportView } from "./components/ReportView";
import { AnnouncementsView } from "./components/AnnouncementsView";
import { SettingsView } from "./components/SettingsView";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { BirthdayReminder } from "./components/BirthdayReminder";
import { SchedulePublishedBanner } from "./components/SchedulePublishedBanner";
import { LegalFooter } from "./legal/LegalFooter";
import { TodayStrip } from "./components/TodayStrip";
import { HomeView } from "./components/HomeView";
import {
  IconLogOut, IconEye, IconHome, IconArrowRight,
  IconMegaphone, IconBuilding, IconClipboard, IconBan, IconTrophy,
  IconCalendarDays, IconUser, IconUsers, IconClock, IconSettings, IconCalendarX,
} from "./components/ui/icons";
import { clubName as clubNameOf } from "./utils/club";
// Read from the club's own settings at runtime — one build serves every club, so there
// is no bundled crest here the way the single-club branch has one.
import { clubLogoSrc } from "./utils/clubLogo";
import {
  subscriptionBlocksEditing,
  subscriptionNeedsAttention,
  describeSubscription,
} from "./utils/subscription";

// The label was "קבוצות, מאמנים ואולמות" — 170px on its own, and the single reason nine
// tabs could not sit on one line. The screen still holds all three; the tab only has to
// name it.
const TABS = [
  { id: "home", label: "בית", Icon: IconHome },
  { id: "announcements", label: "הודעות", Icon: IconMegaphone },
  { id: "rosters", label: "קבוצות ואולמות", Icon: IconBuilding },
  { id: "manager", label: "ניהול", Icon: IconClipboard },
  { id: "constraints", label: "אילוצים", Icon: IconBan },
  { id: "availability", label: "זמינות", Icon: IconCalendarX },
  { id: "games", label: "משחקים", Icon: IconTrophy },
  { id: "weekly", label: "לוח שבועי", Icon: IconCalendarDays },
  { id: "coach", label: "תצוגת מאמן", Icon: IconUser },
  { id: "players", label: "שחקנים", Icon: IconUsers },
  { id: "report", label: "דו\"ח שעות", Icon: IconClock },
  { id: "settings", label: "הגדרות", Icon: IconSettings },
];

// Screens only the club's managers see. The rest are read-only for everyone else, which
// is what the "view only" notice has always meant — these are hidden outright because
// they are building tools: entering sessions, maintaining constraints, the monthly hours
// report, and the club's own settings. A coach has nothing to do with any of them.
//
// Gated on WHO YOU ARE (isAdmin), never on whether you may edit right now. On the
// single-club branch the two are the same value, so `canEdit` reads identically there —
// here they diverge, and using canEdit would hide these screens the moment a
// subscription lapsed. That takes the settings screen away exactly when the manager
// needs it to renew, and it contradicts what lapsing is meant to do: withhold editing,
// hide nothing.
//
// This hides screens; it is NOT a security boundary. Access to the club's data is decided
// by the Firestore rules and the admins/members lists, and every write still goes through
// the same check. Hiding a tab keeps the app uncluttered — it does not protect anything.
const ADMIN_ONLY_TABS = new Set(["manager", "constraints", "availability", "report", "settings"]);

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
  const { data, save, publish, syncJoinCode, loaded, error, isAdmin, mode, missing, subscription } =
    useClubData(user, clubId);
  // Everyone lands on the tiles. It is the screen that says where you are and what there
  // is, and it costs the manager one click to leave.
  const [tab, setTab] = useState("home");
  // "" for a club that has not uploaded a logo — see utils/clubLogo.
  const clubLogo = clubLogoSrc(data);
  const [weekStart, setWeekStart] = useState(todayWeekStart());

  // Paint the club's identity. Must run before the early returns below so the hook
  // order stays stable; applyTheme is a no-op write when the colors haven't changed.
  //
  // The NAME waits until the club document has actually been read. Until then `settings`
  // is DEFAULT_SETTINGS, and writing its placeholder name to the tab title would flash
  // "מועדון ללא שם" over every club's login screen before their own name arrives.
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

  // Two different questions, deliberately kept apart:
  //   isAdmin — who you are. Decides whether the settings tab exists at all, so a club
  //             whose subscription lapsed can still reach the screen that renews it.
  //   canEdit — what you may change right now. A lapsed subscription withholds editing
  //             everywhere; nothing is hidden and nothing is deleted.
  const canEdit = isAdmin && !subscriptionBlocksEditing(subscription);

  // isAdmin, not canEdit — see ADMIN_ONLY_TABS above.
  const visibleTabs = visibleTabsFor(TABS, ADMIN_ONLY_TABS, isAdmin);
  const activeTab = resolveActiveTab(visibleTabs, tab);

  // Was max-w-4xl (896px) everywhere but the board, which is what forced nine tabs onto
  // two rows. The header and the content share it so the tabs stay aligned with the screen
  // they open.
  const headerWidth = activeTab === "weekly" ? "max-w-7xl" : "max-w-6xl";
  const activeScreen = visibleTabs.find((t) => t.id === activeTab);

  return (
    <div className="min-h-screen bg-stone-50" dir="rtl">
      {/* The club's own colours carry the top of the app, and the tabs sit on them like
          tabs on a folder. Everything below stays quiet — a full blue band is a welcome
          for two seconds and a weight for an hour, and the hour is where the work happens. */}
      <div className="bg-gradient-to-bl from-brand-800 via-brand-600 to-brand-500">
        <div className={`${headerWidth} mx-auto px-4 pt-5`}>
          <div className="flex items-start justify-between gap-3 flex-wrap pb-4">
            <div className="flex items-center gap-3">
              {/* Conditional: a club that has not uploaded a logo gets no broken image. */}
              {clubLogo && (
                <img src={clubLogo} alt={clubNameOf(data)} className="w-16 h-16 object-contain shrink-0" />
              )}
              <div>
                {/* Read from the club's settings. Hard-coding the name here is what put
                    "קרית אונו — דור העתיד" above every club's screen. */}
                <h1 className="text-[25px] font-bold text-white tracking-tight leading-tight">
                  {clubNameOf(data)}
                </h1>
                <p className="text-[13px] text-brand-100 mt-0.5">
                  מערכת שעות אימונים · תיאום קבוצות, מאמנים ואולמות
                </p>
              </div>
            </div>
            {isFirebaseConfigured && user && (
              <div className="flex items-center gap-2 text-xs text-brand-100">
                <span className="hidden sm:inline">{user.displayName || user.email}</span>
                <button
                  onClick={signOut}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 text-white transition-colors"
                >
                  <IconLogOut size={13} /> יציאה
                </button>
              </div>
            )}
          </div>

          {/* No tab bar: the home screen's buttons are the navigation, and two mechanisms
              for the same job is one too many. What every screen does need is a way back —
              without it, opening a screen is a one-way door. */}
          {activeTab !== "home" && (
            <nav className="flex items-center gap-2 pb-4" aria-label="ניווט">
              <button
                onClick={() => setTab("home")}
                // min-h-11 is 44px: with the tab bar gone this is the most-used control in
                // the app, and it is pressed with a thumb.
                className="flex items-center gap-1.5 px-4 py-2 min-h-11 rounded-lg border border-white/30 bg-white/10 hover:bg-white/20 text-white text-sm transition-colors"
              >
                {/* In a right-to-left page, "back" points right. */}
                <IconArrowRight size={15} /> חזרה לבית
              </button>
              <span className="text-white/40" aria-hidden="true">·</span>
              <span className="text-white text-sm font-semibold flex items-center gap-1.5">
                {activeScreen?.Icon && <activeScreen.Icon size={15} className="text-brand-100" />}
                {activeScreen?.label}
              </span>
            </nav>
          )}
        </div>
      </div>

      <div className={`${headerWidth} mx-auto px-4 py-6`}>
        {mode === "local" && (
          <p className="text-xs text-amber-700 bg-amber-50 rounded-lg px-3 py-2 mb-4">
            ⚠ מצב מקומי: הנתונים נשמרים בדפדפן הזה בלבד, ולא משותפים אוטומטית עם מכשירים אחרים. חבר את Firebase כדי לעבור לסנכרון בענן (ראה README).
          </p>
        )}
        {mode === "cloud" && !canEdit && (
          <p className="text-xs text-blue-800 bg-blue-50 rounded-lg px-3 py-2 mb-4 flex items-center gap-1.5">
            <IconEye size={13} /> מצב צפייה בלבד — רק מנהל יכול לערוך. אם אתה אמור להיות מנהל, פנה למי שמנהל את הרשימה.
          </p>
        )}

        {error && <div className="mb-4 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg p-2.5">{error}</div>}

        {/* Only the club's own admins ever see this — it is a billing matter, not
            something to put in front of coaches or parents. */}
        {isAdmin && subscriptionNeedsAttention(subscription) && (
          <div
            className={`mb-4 text-xs border rounded-lg p-2.5 flex items-start gap-2 ${
              subscription.state === "expiring"
                ? "bg-amber-50 border-amber-200 text-amber-900"
                : "bg-red-50 border-red-200 text-red-800"
            }`}
          >
            <span aria-hidden="true">⏳</span>
            <span>
              {describeSubscription(subscription)}{" "}
              {activeTab !== "settings" && (
                <button onClick={() => setTab("settings")} className="underline font-medium">
                  פרטי המנוי
                </button>
              )}
            </span>
          </div>
        )}

        <TodayStrip data={data} />

        <SchedulePublishedBanner data={data} />
        {/* Side by side rather than stacked: three full-width bars pushed the board most of
            a screen down, and neither of these needs the whole width to be read. They drop
            to one column on a phone, where there is no width to share. */}
        {activeTab !== "announcements" && (
          <div className="grid sm:grid-cols-2 gap-3 empty:hidden mb-4">
            <AnnouncementBanner data={data} onOpen={() => setTab("announcements")} />
            <BirthdayReminder coaches={data.coaches} weekStart={weekStart} compact />
          </div>
        )}

        {/* Plain region now, not a tab panel: `role="tabpanel"` without a tablist points a
            screen reader at a control that no longer exists. */}
        <div id="screen" role="region" aria-label={activeScreen?.label || "מסך"}>
        {activeTab === "home" ? (
          // The tiles show only what this user may open — same list that builds the tabs,
          // minus the tile that would just lead back here.
          <HomeView
            tabs={visibleTabs.filter((t) => t.id !== "home")}
            data={data}
            weekStart={weekStart}
            onOpen={setTab}
          />
        ) : activeTab === "announcements" ? (
          <AnnouncementsView data={data} save={save} canEdit={canEdit} weekStart={weekStart} />
        ) : activeTab === "rosters" ? (
          <RostersView data={data} save={save} canEdit={canEdit} />
        ) : activeTab === "manager" ? (
          <ManagerView data={data} save={save} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : activeTab === "constraints" ? (
          <ConstraintsView data={data} save={save} canEdit={canEdit} />
        ) : activeTab === "availability" ? (
          <AvailabilityView data={data} save={save} canEdit={canEdit} />
        ) : activeTab === "games" ? (
          <GamesView data={data} save={save} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : activeTab === "weekly" ? (
          <WeeklyScheduleView data={data} save={save} publish={publish} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : activeTab === "coach" ? (
          <CoachView data={data} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : activeTab === "players" ? (
          <PlayersView data={data} save={save} canEdit={canEdit} />
        ) : activeTab === "settings" ? (
          <SettingsView
            data={data}
            save={save}
            canEdit={canEdit}
            syncJoinCode={syncJoinCode}
            clubId={clubId}
            subscription={subscription}
            isAdmin={isAdmin}
            currentEmail={user?.email || ""}
          />
        ) : (
          <ReportView data={data} />
        )}
        </div>

        <LegalFooter className="mt-10 pt-6 border-t border-stone-200" data={data} />
      </div>
    </div>
  );
}
