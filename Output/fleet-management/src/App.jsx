import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "./hooks/useI18n.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useOrgAccess } from "./hooks/useOrgAccess.js";
import { useData } from "./hooks/useData.js";
import { useDriverPortal } from "./hooks/useDriverPortal.js";
import { useActions } from "./hooks/useActions.js";
import { useTeam } from "./hooks/useTeam.js";
import { isFirebaseConfigured } from "./firebase.js";
import TopBar from "./components/TopBar.jsx";
import LoginPage from "./components/LoginPage.jsx";
import NoAccessScreen from "./components/NoAccessScreen.jsx";
import Onboarding from "./components/Onboarding.jsx";
import VehicleLobby from "./components/VehicleLobby.jsx";
import VehiclePage from "./components/VehiclePage.jsx";
import VehicleForm from "./components/VehicleForm.jsx";
import FinesScreen from "./components/FinesScreen.jsx";
import DriversScreen from "./components/DriversScreen.jsx";
import DriverPage from "./components/DriverPage.jsx";
import Dashboard from "./components/Dashboard.jsx";
import SettingsScreen from "./components/SettingsScreen.jsx";
import ReviewScreen from "./components/review/ReviewScreen.jsx";
import DriverPortal from "./components/portal/DriverPortal.jsx";

// מסך הייבוא נטען בנפרד: הוא גורר את מנוע פרסור ה-xlsx, ומשתמשים בו פעם
// בכמה חודשים. אין סיבה שהוא ישב ב-chunk הראשי של כל טעינת עמוד.
const ImportScreen = lazy(() => import("./components/ImportScreen.jsx"));
import { computeAlerts } from "./utils/alerts.js";
import { portalPublishNeeded } from "./utils/portal.js";
import { pendingReviewCount } from "./utils/review.js";
import { todayIso } from "./utils/dates.js";

export default function App() {
  const { t } = useI18n();
  const { user, authLoading, authError, signIn, signInFresh, signOut, isLocal, isEmulator } =
    useAuth();
  // ⚠️ הסדר כאן הוא התיקון של 17.8: קודם **גוזרים את ה-orgId** (מ-
  // memberships/{uid}), ורק אחר כך נרשמים לנתונים. עד עכשיו useData הניח
  // orgId = user.uid, ולכן כל מי שלא יצר את הארגון בעצמו קיבל מסך הקמה.
  const access = useOrgAccess(user);
  const { data, orgId, update, loading, error, resetLocal } = useData(user, access.orgId);
  // actor — מי ביצע את הפעולה, נרשם בשרשרת הראיות של שיוך קנס (D5).
  const actions = useActions(update, orgId, user?.uid || null);
  const team = useTeam({ orgId, data, update });

  // ==========================================================================
  // מסלול הנהג — נבדק **רק** כשמסלול האדמין החזיר 'none'.
  //
  // אדמין שהוא גם נהג נשאר במסלול האדמין: הוא רואה שם ממילא הכל, ושני מסלולים
  // פעילים בו-זמנית היו מייצרים שאלת "איזה מסך מוצג" שאין לה תשובה נכונה.
  // ה-hook אינו נרשם לשום מאזין כשהוא כבוע — ראה useDriverPortal.
  // ==========================================================================
  const portalEnabled = isFirebaseConfigured && access.status === "none";
  const portal = useDriverPortal(user, { enabled: portalEnabled });

  // ==========================================================================
  // publish — פרסום ההיטל של הנהגים, מהאדמין, כשיש הפרש.
  //
  // ⚠️ **בלי זה הפורטל ריק ב-27 נהגים אמיתיים.** ההיטל הוא נגזרת שנכתבת
  // ב-`update`, כלומר הוא מתעדכן רק כשאדמין שומר משהו. הנתונים בפרודקשן
  // נוצרו לפני שהאוסף היה קיים, ולכן בלי פרסום יזום העובד הראשון שייכנס
  // יראה "לא רשום עליך רכב" — והמסקנה תהיה שהפיצ'ר שבור.
  //
  // ⚠️ הפרסום מותנה ב-`portalPublishNeeded`, שהיא השוואה עמוקה — אין הפרש,
  // אין כתיבה, אין לולאה. ה-`today` בתוך החישוב זז פעם ביום, וזה **רצוי**:
  // כך החזקה שהסתיימה אתמול מפסיקה להיות קריאה לנהג גם אם אף אדמין לא נגע
  // בכלום. `publishedRef` מגביל לניסיון אחד לכל טעינה, כדי ששגיאת כתיבה
  // לא תהפוך לניסיון חוזר בלולאה.
  // ==========================================================================
  const publishedRef = useRef(false);
  useEffect(() => {
    if (!isFirebaseConfigured || loading || !orgId) return;
    if (!data?.settings?.onboarded || access.status !== "member") return;
    if (publishedRef.current) return;
    if (!portalPublishNeeded(data, todayIso())) return;
    publishedRef.current = true;
    // update() מחיל את הנגזרת בעצמו (useData:withDerived) — כאן רק מפעילים
    // שמירה שאינה משנה דבר אחר.
    update((d) => d).catch?.((err) => console.error("portal publish failed", err));
  }, [loading, orgId, access.status, data, update]);

  // ניווט פשוט ב-state (בלי router — 6 מסכים, שני מסכי-עומק).
  const [view, setView] = useState("dashboard");
  const [vehicleId, setVehicleId] = useState(null);
  const [driverId, setDriverId] = useState(null);
  const [addingVehicle, setAddingVehicle] = useState(false);

  const alertCount = useMemo(
    () => (data?.vehicles ? computeAlerts(data, todayIso(), data.settings).total : 0),
    [data]
  );
  // מונה ההחזקות שממתינות לאימות — מוצג כתג על פריט הניווט, ונעלם כשכולן נפתרו.
  const reviewCount = useMemo(() => pendingReviewCount(data), [data?.assignments]);

  if (authLoading) return <Splash text={t("common.loading")} />;
  if (isFirebaseConfigured && !user)
    return (
      <LoginPage
        onSignIn={signIn}
        onSignInFresh={signInFresh}
        isEmulator={isEmulator}
        error={authError}
      />
    );
  // -- שער הגישה: מה קורה **לפני** שיש orgId ------------------------------
  if (access.status === "loading") return <Splash text={t("common.loading")} />;
  // ⚠️ אין הרשאה → "פנה למנהל המערכת". זה בדיוק המצב שבו מנהלת הכספים קיבלה
  // מסך הקמה ראשונית, שאילו השלימה היה יוצר ארגון שני נפרד עם אפס רכבים.
  // ההקמה מגיעה **רק** ב-status 'bootstrap' — כשמזהה הארגון הוא ה-uid שלנו
  // והמסמך באמת אינו קיים, כלומר התקנה חדשה שאין למי לפנות בה.
  // ==========================================================================
  // ⚠️ **סדר שלושת המסכים כאן הוא כל ההבדל.**
  //   ב-allowlist          → אדמין.
  //   מקושר כנהג           → פורטל.
  //   אף אחד מהם           → "אין הרשאה".
  // **לעולם לא onboarding.** זה בדיוק הבאג של 17.8: מי שלא הייתה מורשית קיבלה
  // מסך הקמה, ואילו השלימה אותו היה נוצר ארגון שני נפרד עם אפס רכבים. עכשיו
  // יש עוד מצב באמצע (נהג), ולכן החוק הזה חשוב יותר, לא פחות.
  // ==========================================================================
  if (portalEnabled && portal.status === "loading") return <Splash text={t("common.loading")} />;
  if (portalEnabled && portal.status === "linked")
    return (
      <DriverPortal
        driver={portal.driver}
        entry={portal.entry}
        readings={portal.readings}
        onSubmitReading={portal.submitReading}
        onSignOut={signOut}
        contact={t("portal.contactFallback")}
      />
    );

  if (access.status === "none" || access.status === "error")
    return (
      <NoAccessScreen
        user={user}
        emailVerified={access.emailVerified}
        isError={access.status === "error"}
        onRetry={access.retry}
        onSignOut={signOut}
      />
    );

  if (loading) return <Splash text={t("common.loading")} />;

  // מסך 0 — Onboarding עד שיש ארגון מוגדר.
  if (!data.settings?.onboarded) {
    return (
      <Onboarding
        orgId={orgId}
        onComplete={async (payload) => {
          // ההקמה היא הכתיבה הראשונה בענן, והיא זו שיוצרת את מסמך הארגון.
          // אם היא נדחית — נשארים במסך ההקמה עם הסבר, ולא נזרקים ללובי ריק.
          const res = await actions.completeOnboarding(payload);
          if (res?.ok !== false) setView("vehicles");
          return res;
        }}
      />
    );
  }

  const openVehicle = (id) => {
    setVehicleId(id);
    setView("vehicle");
  };
  const openDriver = (id) => {
    setDriverId(id);
    setView("driver");
  };

  const navView = ["vehicle"].includes(view)
    ? "vehicles"
    : ["driver"].includes(view)
    ? "drivers"
    : view;

  return (
    <div className="min-h-screen bg-slate-50">
      <TopBar
        view={navView}
        onNavigate={setView}
        orgName={data.org?.name}
        isLocal={isLocal}
        onSignOut={signOut}
        alertCount={alertCount}
        reviewCount={reviewCount}
      />

      {error && (
        <div className="mx-auto mt-3 flex max-w-7xl items-center gap-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle size={15} />
          {t(error)}
        </div>
      )}

      <main className="mx-auto max-w-7xl px-4 py-4">
        {view === "dashboard" && (
          <Dashboard
            data={data}
            onOpenVehicle={openVehicle}
            onOpenFines={() => setView("fines")}
            onOpenReview={() => setView("review")}
            onOpenDriver={openDriver}
          />
        )}
        {view === "review" && (
          <ReviewScreen data={data} actions={actions} onDone={() => setView("vehicles")} />
        )}
        {view === "vehicles" && (
          <VehicleLobby
            data={data}
            onOpenVehicle={openVehicle}
            onAddVehicle={() => setAddingVehicle(true)}
          />
        )}
        {view === "vehicle" && (
          <VehiclePage
            vehicleId={vehicleId}
            data={data}
            orgId={orgId}
            actions={actions}
            onBack={() => setView("vehicles")}
          />
        )}
        {view === "fines" && <FinesScreen data={data} orgId={orgId} actions={actions} />}
        {view === "drivers" && (
          <DriversScreen data={data} orgId={orgId} actions={actions} onOpenDriver={openDriver} />
        )}
        {view === "driver" && (
          <DriverPage
            driverId={driverId}
            data={data}
            orgId={orgId}
            actions={actions}
            onBack={() => setView("drivers")}
            onOpenVehicle={openVehicle}
          />
        )}
        {view === "import" && (
          <Suspense fallback={<p className="py-10 text-center text-sm text-slate-500">{t("common.loading")}</p>}>
            <ImportScreen
              data={data}
              orgId={orgId}
              actions={actions}
              onDone={() => setView("vehicles")}
            />
          </Suspense>
        )}
        {view === "settings" && (
          <SettingsScreen
            data={data}
            orgId={orgId}
            actions={actions}
            onResetLocal={resetLocal}
            user={user}
            team={team}
          />
        )}
      </main>

      {isLocal && (
        <footer className="mx-auto max-w-7xl px-4 pb-6">
          <p className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
            {t("auth.localModeNote")}
          </p>
        </footer>
      )}

      {addingVehicle && (
        <VehicleForm
          open
          orgId={orgId}
          leaseCompanies={data.leaseCompanies}
          onClose={() => setAddingVehicle(false)}
          onSave={(v, cost) => {
            actions.saveVehicle(v, cost);
            openVehicle(v.id);
          }}
        />
      )}
    </div>
  );
}

function Splash({ text }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <p className="text-sm text-slate-500">{text}</p>
    </div>
  );
}
