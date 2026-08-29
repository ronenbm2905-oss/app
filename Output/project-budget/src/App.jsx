import { useMemo, useState } from "react";
import { useData } from "./hooks/useData.js";
import { useAuth } from "./hooks/useAuth.js";
import { projectSlice, currentMonth } from "./utils/selectors.js";
import { isFirebaseConfigured } from "./firebase.js";
import { ROLE_OWNER, ROLE_MANAGER, canEditBudget, canManageProject, roleOf } from "./utils/access.js";

import LoginPage from "./components/LoginPage.jsx";
import ProjectLobby from "./components/ProjectLobby.jsx";
import InvoicesView from "./components/InvoicesView.jsx";
import ClaimBatchesView from "./components/ClaimBatchesView.jsx";
import CashflowView from "./components/CashflowView.jsx";
import BudgetView from "./components/BudgetView.jsx";
import MembersPanel from "./components/MembersPanel.jsx";
import ProjectSettings from "./components/ProjectSettings.jsx";
import TopBar from "./components/TopBar.jsx";
import { IconWarning } from "./components/ui/icons.jsx";

const TABS = [
  { key: "invoices", label: "חשבוניות" },
  { key: "claims", label: "מנות מס רכוש" },
  { key: "cashflow", label: "תזרים" },
  { key: "budget", label: "תקציב מול ביצוע" },
  { key: "settings", label: "הגדרות" },
];

export default function App() {
  const auth = useAuth();
  const store = useData(auth.user);
  const { data, setSettings } = store;
  const [tab, setTab] = useState("invoices");

  const projectId = data.settings.activeProjectId;
  const slice = useMemo(() => projectSlice(data, projectId), [data, projectId]);
  const asOfMonth = currentMonth();

  /**
   * במצב מקומי אין אימות ולכן אין תפקיד אמיתי — הכול פתוח, וזה נאמר במפורש
   * בממשק במקום להעמיד פנים שיש הרשאות.
   */
  const role = auth.isLocal ? ROLE_OWNER : roleOf(slice.project, auth.user?.email);
  const canReport = auth.isLocal || role === ROLE_OWNER || role === ROLE_MANAGER;
  const canOwn = auth.isLocal || canEditBudget(role);

  if (auth.loading || store.loading) {
    return <div className="p-8 text-center text-ink-muted">טוען…</div>;
  }

  if (!auth.isLocal && !auth.user) {
    return <LoginPage onSignIn={auth.signIn} error={auth.error} />;
  }

  if (!slice.project) {
    return <ProjectLobby store={store} auth={auth} />;
  }

  // חבר שהוסר מהפרויקט בזמן שהוא פתוח אצלו — עדיף מסך מפורש על מסך ריק.
  if (!auth.isLocal && !role) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <IconWarning size={32} className="mx-auto text-warning-text" />
        <h1 className="mt-4 text-lg font-semibold">אין לך גישה לפרויקט הזה</h1>
        <p className="mt-2 text-sm text-ink-muted">
          {auth.user.email} אינו ברשימת החברים. בקש מבעל הפרויקט להוסיף אותך.
        </p>
        <button
          onClick={() => setSettings({ activeProjectId: null })}
          className="mt-4 text-sm font-semibold text-link underline"
        >
          חזרה לרשימת הפרויקטים
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <TopBar
        project={slice.project}
        store={store}
        auth={auth}
        role={role}
        onSwitchProject={() => setSettings({ activeProjectId: null })}
        cloudMode={isFirebaseConfigured}
      />

      {store.syncError && (
        <div className="border-b border-danger-solid/30 bg-danger-fill px-4 py-2 text-center text-sm text-danger-text">
          שגיאת סנכרון: {store.syncError}
        </div>
      )}

      <nav className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`-mb-px shrink-0 border-b-2 px-4 py-3 text-sm font-semibold transition ${
                tab === t.key
                  ? "border-accent text-navy"
                  : "border-transparent text-ink-muted hover:text-navy"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {tab === "invoices" && <InvoicesView slice={slice} store={store} canEdit={canReport} />}
        {tab === "claims" && <ClaimBatchesView slice={slice} store={store} canEdit={canOwn} />}
        {tab === "cashflow" && (
          <CashflowView slice={slice} store={store} canEdit={canOwn} asOfMonth={asOfMonth} />
        )}
        {tab === "budget" && <BudgetView slice={slice} />}
        {tab === "settings" && (
          <SettingsTab
            project={slice.project}
            store={store}
            myEmail={auth.user?.email}
            canEdit={auth.isLocal || canManageProject(role)}
            cloudMode={isFirebaseConfigured}
          />
        )}
      </main>
    </div>
  );
}

/** הגדרות הפרויקט וההרשאות יושבות יחד — שתיהן "מי ומה הפרויקט", ושתיהן בעלים בלבד. */
function SettingsTab({ project, store, myEmail, canEdit, cloudMode }) {
  const [section, setSection] = useState("project");
  const SECTIONS = [
    { key: "project", label: "פרטי הפרויקט" },
    { key: "members", label: "הרשאות" },
  ];

  return (
    <div>
      <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-border bg-white p-1">
        {SECTIONS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`rounded-sm px-4 py-1.5 text-sm font-semibold transition ${
              section === s.key
                ? "bg-navy text-white"
                : "text-ink-muted hover:bg-surface-alt hover:text-navy"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === "project" && (
        <ProjectSettings project={project} store={store} canEdit={canEdit} />
      )}
      {section === "members" && (
        <MembersPanel
          project={project}
          store={store}
          myEmail={myEmail}
          canEdit={canEdit}
          cloudMode={cloudMode}
        />
      )}
    </div>
  );
}
