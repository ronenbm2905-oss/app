import { FlaskConical, LogOut, Trash } from "lucide-react";
import { useAuth } from "./hooks/useAuth";
import { useLeads } from "./hooks/useLeads";
import { LeadsView } from "./components/LeadsView";
import { LoginView } from "./components/LoginView";
import { Banner } from "./components/ui/Banner";
import { t } from "./i18n";
import { isFirebaseConfigured, appCheckConfigured } from "./firebase";

export default function App() {
  const { user, ready, error: authError, login, logout, isLocal } = useAuth();
  const leadsState = useLeads(user);

  if (!ready) {
    return <p className="py-20 text-center text-ink-soft">{t("loading")}</p>;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-paper px-4">
        <LoginView onLogin={login} error={authError} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-paper-line bg-paper-card">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-ink">{t("appTitle")}</h1>
            {/* ⚠️ S1 נתיב א': "יועץ מס מייצג". המילה "רו״ח" אינה מופיעה
                בשום מקום במוצר — נאכף ב-`npm run check`. */}
            <p className="text-xs text-ink-faint">{t("appSubtitle")}</p>
          </div>
          {!isLocal && (
            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center gap-1.5 rounded-lg border border-paper-line px-3 py-1.5 text-sm text-ink-soft transition hover:border-accent/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              {t("signOut")}
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        {isLocal && (
          <Banner tone="warn" title={t("localModeTitle")}>
            <p>{t("localModeBody")}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={leadsState.addTestLead}
                className="inline-flex items-center gap-1.5 rounded-md border border-warn/40 bg-paper-card px-2.5 py-1 text-xs text-ink transition hover:border-warn focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <FlaskConical className="h-3.5 w-3.5" aria-hidden="true" />
                {t("addTestLead")}
              </button>
              <button
                type="button"
                onClick={leadsState.clearLocal}
                className="inline-flex items-center gap-1.5 rounded-md border border-paper-line bg-paper-card px-2.5 py-1 text-xs text-ink-soft transition hover:border-danger/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
              >
                <Trash className="h-3.5 w-3.5" aria-hidden="true" />
                {t("clearLocal")}
              </button>
              <span className="self-center text-xs text-ink-faint">{t("testLeadNote")}</span>
            </div>
          </Banner>
        )}

        {/* 🔴 R-5 — App Check הוא חוסם go-live. הבאנר הזה נשאר על המסך עד
            שהוא מוגדר, כדי שלא יישכח בין ההקמה לעלייה לאוויר. */}
        {isFirebaseConfigured && !appCheckConfigured && (
          <Banner tone="danger" title={t("appCheckMissing")} />
        )}

        <LeadsView
          leads={leadsState.leads}
          loading={leadsState.loading}
          error={leadsState.error}
          busyId={leadsState.busyId}
          dueForPurgeCount={leadsState.dueForPurgeCount}
          onStatusChange={leadsState.setStatus}
        />
      </main>
    </div>
  );
}
