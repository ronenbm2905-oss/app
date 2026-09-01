import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useClubData } from "./hooks/useClubData";
import { useGameNotes } from "./hooks/useGameNotes";
import { useTrainingPlans } from "./hooks/useTrainingPlans";
import { usePendingImport } from "./hooks/usePendingImport";
import { useVideos } from "./hooks/useVideos";
import { usePlayerProgress } from "./hooks/usePlayerProgress";
import { todayWeekStart } from "./utils/dates";
import { coachForUser } from "./utils/coachIdentity";
import { visibleTabsFor, resolveActiveTab } from "./utils/tabs";
import { LoginPage } from "./components/LoginPage";
import { RostersView } from "./components/RostersView";
import { ManagerView } from "./components/ManagerView";
import { ConstraintsView } from "./components/ConstraintsView";
import { AvailabilityView } from "./components/AvailabilityView";
import { VideosView } from "./components/VideosView";
import { GamesView } from "./components/GamesView";
import { WeeklyScheduleView } from "./components/WeeklyScheduleView";
import { CoachView } from "./components/CoachView";
import { PlayersView } from "./components/PlayersView";
import { PlayerProgressView } from "./components/PlayerProgressView";
import { ReportView } from "./components/ReportView";
import { AnnouncementsView } from "./components/AnnouncementsView";
import { AnnouncementBanner } from "./components/AnnouncementBanner";
import { PendingImportBanner } from "./components/PendingImportBanner";
import { BirthdayReminder } from "./components/BirthdayReminder";
import { LegalFooter } from "./legal/LegalFooter";
import { TodayStrip } from "./components/TodayStrip";
import { HomeView } from "./components/HomeView";
import { Greeting } from "./components/Greeting";
import {
  IconLogOut, IconEye, IconHome, IconArrowRight,
  IconMegaphone, IconBuilding, IconClipboard, IconBan, IconTrophy,
  IconCalendarDays, IconUser, IconUsers, IconClock, IconCalendarX, IconVideo, IconPencil,
} from "./components/ui/icons";
import clubLogo from "./assets/club-logo.jpg";

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
  { id: "videos", label: "סרטוני אימון", Icon: IconVideo },
  { id: "progress", label: "התקדמות שחקנים", Icon: IconPencil },
  { id: "players", label: "שחקנים", Icon: IconUsers },
  { id: "report", label: "דו\"ח שעות", Icon: IconClock },
];

// Screens only the club's managers see. The rest are read-only for everyone else, which
// is what the "view only" notice has always meant — these are hidden outright. Three are
// building tools a coach has nothing to do with: entering sessions, maintaining
// constraints, and the monthly hours report. The fourth, the player list, is hidden for a
// different reason — it holds minors' personal details, and a coach does not need the
// whole club's roster to do their job.
//
// This hides screens; it is NOT a security boundary. Access to the club's data is decided
// by the Firestore rules and the admins/members lists, and every write still goes through
// the same check. Hiding a tab keeps the app uncluttered — it does not protect anything.
const ADMIN_ONLY_TABS = new Set(["manager", "constraints", "availability", "report", "players"]);

// The roster screen shows a coach two of its three cards — halls are a manager's concern
// and are hidden from them — so the tab that opens it should not promise a third. Same
// screen, honest name.
const COACH_TAB_LABELS = { rosters: "קבוצות ומאמנים" };

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
  // The listeners are scoped by role: a manager listens to every record, a coach only to
  // their own. This is not cosmetic — a coach's unscoped listen is refused outright.
  const myEmail = user?.email || "";
  const { notes, saveNote } = useGameNotes(user, isAdmin, myEmail);
  const { plans, savePlan } = useTrainingPlans(user, isAdmin, myEmail);
  // Only a manager is offered the nightly federation proposal — a coach has nothing to
  // decide about an import, and the listener is not even opened for them.
  const { pending, resolvePending } = usePendingImport(user, isAdmin);
  // The drill-video library is shared: every coach reads it and every coach adds to it, so
  // unlike the notes and plans hooks this one takes no role and scopes no query.
  const { videos, saveVideo, removeVideo, videosReady } = useVideos(user);
  // Half-season progress notes. Scoped like the notes and plans hooks — a coach listens
  // only to their own, because the rule gives them nothing else and an unscoped listen is
  // refused outright rather than filtered.
  const { progress, saveProgress } = usePlayerProgress(user, isAdmin, myEmail);
  // Everyone lands on the tiles. It is the screen that says where you are and what there
  // is, and it costs the manager one click to leave — the tab bar is still right there.
  const [tab, setTab] = useState("home");
  const [weekStart, setWeekStart] = useState(todayWeekStart());

  // Cloud mode: wait for auth, then require sign-in.
  if (isFirebaseConfigured && authLoading) return <Loading />;
  if (isFirebaseConfigured && !user) return <LoginPage onSignIn={signIn} authError={authError} />;
  if (!loaded) return <Loading />;

  const canEdit = isAdmin;
  // A coach's own record, when an admin has filled in their sign-in address.
  const myCoachId = canEdit ? null : coachForUser(user, data.coaches)?.id || null;
  // Who gets a count of today's sessions at all. A manager sees the club's day because
  // running it is the job. A coach the club can place sees their own. Anyone else — a
  // viewer with no coach record, or a coach whose sign-in address nobody filled in — gets
  // the date and whether the week is published, and no sessions: the club's workload was
  // never theirs to read, and guessing that an unplaceable viewer is "everyone" is exactly
  // how a non-coach ended up looking at five other people's trainings.
  const showSessions = canEdit || Boolean(myCoachId);

  const visibleTabs = visibleTabsFor(TABS, ADMIN_ONLY_TABS, canEdit).map((t) =>
    !canEdit && COACH_TAB_LABELS[t.id] ? { ...t, label: COACH_TAB_LABELS[t.id] } : t
  );
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
      {/* no-print by class, not by position. The old stylesheet hid the header with
          `#root > div > div > header`, which stopped matching the moment this band
          replaced the old header — so the app chrome started printing on top of every
          report. A class cannot be broken by rearranging the page. */}
      <div className="no-print bg-gradient-to-bl from-brand-800 via-brand-600 to-brand-500">
        <div className={`${headerWidth} mx-auto px-4 pt-5`}>
          <div className="flex items-start justify-between gap-3 flex-wrap pb-4">
            <div className="flex items-center gap-3">
              <img src={clubLogo} alt="עירוני קריית אונו – כדורסל דור העתיד" className="w-16 h-16 object-contain shrink-0" />
              <div>
                <h1 className="text-[25px] font-bold text-white tracking-tight leading-tight">
                  קרית אונו — דור העתיד
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
        {/* Home only, and above everything else: the greeting is the first thing the
            screen says, before today's line and before the tiles. */}
        {activeTab === "home" && <Greeting user={user} coaches={data.coaches} canEdit={canEdit} />}

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

        {/* The club's standing notice comes first, above the day. It is the one thing on
            this screen written by a person to be read by everyone, and it used to sit
            under the day's line sharing a row — which put the association's message below
            a schedule summary. */}
        {activeTab !== "announcements" && (
          <div className="mb-4 empty:hidden">
            <AnnouncementBanner data={data} onOpen={() => setTab("announcements")} />
          </div>
        )}

        {isAdmin && pending && (
          <div className="mb-4">
            <PendingImportBanner pending={pending} data={data} save={save} resolvePending={resolvePending} />
          </div>
        )}

        <TodayStrip data={data} coachId={myCoachId} showSessions={showSessions} />

        {/* The published state is already a chip inside TodayStrip. The full-width banner
            that used to sit here said the same thing three lines louder, directly under the
            line that had just said it. */}
        {activeTab !== "announcements" && (
          <div className="mb-4 empty:hidden">
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
            canEdit={canEdit}
            notes={notes}
            videoCount={videosReady ? videos.length : undefined}
            progress={progress}
            onOpen={setTab}
          />
        ) : activeTab === "announcements" ? (
          <AnnouncementsView data={data} save={save} canEdit={canEdit} weekStart={weekStart} />
        ) : activeTab === "rosters" ? (
          <RostersView data={data} save={save} canEdit={canEdit} currentEmail={user?.email || ""} />
        ) : activeTab === "manager" ? (
          <ManagerView data={data} save={save} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} />
        ) : activeTab === "constraints" ? (
          <ConstraintsView data={data} save={save} canEdit={canEdit} />
        ) : activeTab === "availability" ? (
          <AvailabilityView data={data} save={save} canEdit={canEdit} />
        ) : activeTab === "games" ? (
          <GamesView
            data={data}
            save={save}
            canEdit={canEdit}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            notes={notes}
            saveNote={saveNote}
            authorName={user?.displayName || user?.email || ""}
            authorEmail={myEmail}
            myCoachId={myCoachId}
          />
        ) : activeTab === "weekly" ? (
          <WeeklyScheduleView data={data} save={save} canEdit={canEdit} weekStart={weekStart} setWeekStart={setWeekStart} myCoachId={myCoachId} />
        ) : activeTab === "coach" ? (
          <CoachView
            data={data}
            fixedCoachId={myCoachId}
            canEdit={canEdit}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            plans={plans}
            savePlan={savePlan}
            authorName={user?.displayName || user?.email || ""}
            authorEmail={myEmail}
          />
        ) : activeTab === "videos" ? (
          <VideosView
            data={data}
            user={user}
            canEdit={canEdit}
            videos={videos}
            saveVideo={saveVideo}
            removeVideo={removeVideo}
            videosReady={videosReady}
          />
        ) : activeTab === "progress" ? (
          <PlayerProgressView
            data={data}
            canEdit={canEdit}
            myCoachId={myCoachId}
            progress={progress}
            saveProgress={saveProgress}
            authorName={user?.displayName || user?.email || ""}
            authorEmail={myEmail}
          />
        ) : activeTab === "players" ? (
          <PlayersView data={data} save={save} canEdit={canEdit} progress={progress} />
        ) : (
          <ReportView data={data} weekStart={weekStart} />
        )}
        </div>

        {/* Off paper. It was printing at the bottom of every report the club hands out —
            three legal links and a copyright line under a hall schedule. */}
        <LegalFooter className="no-print mt-10 pt-6 border-t border-stone-200" />
      </div>
    </div>
  );
}
