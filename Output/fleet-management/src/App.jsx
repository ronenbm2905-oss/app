import { lazy, Suspense, useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useI18n } from "./hooks/useI18n.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useData } from "./hooks/useData.js";
import { useActions } from "./hooks/useActions.js";
import { isFirebaseConfigured } from "./firebase.js";
import TopBar from "./components/TopBar.jsx";
import LoginPage from "./components/LoginPage.jsx";
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

// מסך הייבוא נטען בנפרד: הוא גורר את מנוע פרסור ה-xlsx, ומשתמשים בו פעם
// בכמה חודשים. אין סיבה שהוא ישב ב-chunk הראשי של כל טעינת עמוד.
const ImportScreen = lazy(() => import("./components/ImportScreen.jsx"));
import { computeAlerts } from "./utils/alerts.js";
import { pendingReviewCount } from "./utils/review.js";
import { todayIso } from "./utils/dates.js";

export default function App() {
  const { t } = useI18n();
  const { user, authLoading, authError, signIn, signOut, isLocal } = useAuth();
  const { data, orgId, update, loading, error, resetLocal } = useData(user);
  // actor — מי ביצע את הפעולה, נרשם בשרשרת הראיות של שיוך קנס (D5).
  const actions = useActions(update, orgId, user?.uid || null);

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
  if (isFirebaseConfigured && !user) return <LoginPage onSignIn={signIn} error={authError} />;
  if (loading) return <Splash text={t("common.loading")} />;

  // מסך 0 — Onboarding עד שיש ארגון מוגדר.
  if (!data.settings?.onboarded) {
    return (
      <Onboarding
        orgId={orgId}
        onComplete={(payload) => {
          actions.completeOnboarding(payload);
          setView("vehicles");
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
          <SettingsScreen data={data} orgId={orgId} actions={actions} onResetLocal={resetLocal} />
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
