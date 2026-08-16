import { useMemo, useState } from "react";
import { isFirebaseConfigured } from "./firebase.js";
import { useI18n } from "./hooks/useI18n.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useData } from "./hooks/useData.js";
import { useActions } from "./hooks/useActions.js";
import { useRoute } from "./hooks/useRoute.js";
import { todayIso } from "./utils/dates.js";
import { POLICY_VERSION } from "./constants.js";
import { hasAcknowledged } from "./schema.js";

import AppShell from "./components/AppShell.jsx";
import LoginPage from "./components/LoginPage.jsx";
import Onboarding from "./components/Onboarding.jsx";
import Dashboard from "./components/Dashboard.jsx";
import VehiclesScreen from "./components/VehiclesScreen.jsx";
import AddVehicleScreen from "./components/AddVehicleScreen.jsx";
import VehicleScreen from "./components/VehicleScreen.jsx";
import TaskScreen from "./components/TaskScreen.jsx";
import DocumentsScreen from "./components/DocumentsScreen.jsx";
import EmergencyScreen from "./components/EmergencyScreen.jsx";
import SettingsScreen from "./components/SettingsScreen.jsx";
import NoticeScreen from "./components/NoticeScreen.jsx";
import AccessibilityScreen from "./components/AccessibilityScreen.jsx";
import { LoadingBlock } from "./components/ui/Skeleton.jsx";
import { Notice } from "./components/ui/Card.jsx";
import Button from "./components/ui/Button.jsx";
import CompleteTaskSheet from "./components/CompleteTaskSheet.jsx";
import { vehicleById } from "./utils/options.js";

// ============================================================================
// App — הראוטר והחיווט.
//
// 🔴 **שער החירום**: אין שום נתיב שמגיע ל-EmergencyScreen בלי משתמש מאומת.
// במצב ענן, `!user` מחזיר את מסך הכניסה **לכל מסלול**, כולל `#/emergency` —
// כלומר ה-shortcut מה-manifest נוחת על מסך כניסה, לא על נתיב עוקף. זה
// מבנה, לא בדיקה נקודתית: אין `if (route === "emergency")` שאפשר לשכוח.
// ============================================================================

const TITLE_BY_ROUTE = {
  home: null,
  vehicles: "dashboard.vehicles.title",
  vehicleNew: "vehicle.add.title",
  vehicle: "nav.vehicles",
  task: "nav.home",
  taskNew: "task.form.title.new",
  docs: "nav.docs",
  emergency: "emergency.title",
  settings: "settings.title",
  accessibility: "accessibility.title",
  notice: "legal.notice.title",
  notFound: "error.notFound.title",
};

const BACK_ROUTES = ["vehicle", "vehicleNew", "task", "taskNew", "accessibility", "notice"];

export default function App() {
  const { t } = useI18n();
  const { user, authLoading, authError, signIn, signOut, isLocal } = useAuth();
  const { data, householdId, update, loading, error, setError, canEdit } = useData(user);
  const actions = useActions(update, householdId, user);
  const { route, navigate, back } = useRoute();
  // "בוצע" בלחיצה אחת מכרטיס-הגיבור — היציאה המיידית כשהאפליקציה טועה.
  const [fixing, setFixing] = useState(null);

  const today = todayIso();
  const onboarded = data?.settings?.onboarded;

  const title = useMemo(() => {
    const key = TITLE_BY_ROUTE[route.name];
    return key ? t(key) : null;
  }, [route.name, t]);

  // -- שער הכניסה (מצב ענן בלבד) --------------------------------------------
  if (isFirebaseConfigured && authLoading) {
    return (
      <div className="min-h-dvh bg-canvas p-4">
        <LoadingBlock label={t("loading.signIn")} lines={2} />
      </div>
    );
  }
  if (isFirebaseConfigured && !user) {
    return <LoginPage onSignIn={signIn} loading={authLoading} error={authError} />;
  }

  // -- אונבורדינג: מסך ערך → תרגול חירום → הוספת הרכב הראשון ---------------
  if (!onboarded) {
    return (
      <Onboarding
        onStart={() => {
          actions.setSettings({ onboarded: true });
          navigate("/vehicles/new");
        }}
      />
    );
  }

  const shared = { data, actions, householdId, uid: user?.uid, today, canEdit, isLocal, navigate };

  const screen = () => {
    switch (route.name) {
      case "home":
        return <Dashboard data={data} today={today} onFix={setFixing} />;
      case "vehicles":
        return <VehiclesScreen data={data} today={today} />;
      case "vehicleNew":
        return <AddVehicleScreen {...shared} />;
      case "vehicle":
        return <VehicleScreen vehicleId={route.params.id} {...shared} />;
      case "task":
        return <TaskScreen taskId={route.params.id} {...shared} />;
      case "docs":
        return <DocumentsScreen {...shared} />;
      case "emergency":
        return <EmergencyScreen data={data} uid={user?.uid} today={today} navigate={navigate} />;
      case "settings":
        return <SettingsScreen data={data} actions={actions} user={user} isLocal={isLocal} onSignOut={signOut} navigate={navigate} />;
      case "notice":
        return <NoticeScreen data={data} actions={actions} />;
      case "accessibility":
        return <AccessibilityScreen />;
      default:
        return (
          <Notice tone="warn" title={t("error.notFound.title")}>
            <p>{t("error.notFound.body")}</p>
            <Button variant="primary" size="md" className="mt-3" onClick={() => navigate("/")}>
              {t("error.notFound.cta")}
            </Button>
          </Notice>
        );
    }
  };

  const noticePending = !isLocal && !hasAcknowledged(data.profile, POLICY_VERSION);

  return (
    <AppShell
      routeName={route.name}
      title={title}
      onBack={BACK_ROUTES.includes(route.name) ? back : null}
    >
      {isLocal && (
        <Notice tone="info" title={t("auth.localMode")}>
          <p>{t("auth.localMode.note")}</p>
        </Notice>
      )}

      {/* N5 — היידוע מוצג עד שהמשתמש מאשר; האישור הוא append, לא דריסה. */}
      {noticePending && route.name !== "notice" && (
        <Notice
          tone="info"
          title={t("legal.notice.title")}
          action={
            <Button variant="secondary" size="md" onClick={() => navigate("/settings/notice")}>
              {t("legal.notice.reopen")}
            </Button>
          }
        >
          <p>{t("legal.notice.body")}</p>
        </Notice>
      )}

      {error && (
        <Notice
          tone="danger"
          title={t(error)}
          action={
            <Button variant="primary" size="md" onClick={() => setError(null)}>
              {t("common.retry")}
            </Button>
          }
        >
          <p>{t("error.load.body")}</p>
        </Notice>
      )}

      {/* פעולת התיקון מכרטיס-הגיבור: אותו CompleteTaskSheet, אותו חוק —
          המשימה הבאה מוצגת לפני השמירה. */}
      {fixing && (
        <CompleteTaskSheet
          task={fixing}
          vehicle={vehicleById(data, fixing.vehicleId)}
          data={data}
          today={today}
          onConfirm={({ completedDate, completedKm, overrideDue }) => {
            actions.completeTask(fixing, { today, completedDate, completedKm, motDate: overrideDue || null });
            setFixing(null);
          }}
          onCancel={() => setFixing(null)}
        />
      )}

      {loading ? <LoadingBlock label={t("loading.dashboard")} /> : screen()}

      {!canEdit && !isLocal && (
        <Notice tone="warn" title={t("error.permission.title")}>
          <p>{t("error.permission.body")}</p>
        </Notice>
      )}
    </AppShell>
  );
}
