import { useState, useMemo } from "react";
import { useI18n } from "./hooks/useI18n.jsx";
import { useAuth } from "./hooks/useAuth.js";
import { useData } from "./hooks/useData.js";
import { useRole } from "./hooks/useRole.js";
import { TopBar } from "./components/TopBar.jsx";
import { LoginPage } from "./components/LoginPage.jsx";
import { Onboarding } from "./components/Onboarding.jsx";
import { Lobby } from "./components/Lobby.jsx";
import { PropertyPage } from "./components/PropertyPage.jsx";
import { FinancialDashboard } from "./components/FinancialDashboard.jsx";
import { MaintenanceDashboard } from "./components/MaintenanceDashboard.jsx";
import { TicketForm } from "./components/TicketForm.jsx";
import { TenantPortal } from "./components/TenantPortal.jsx";
import { MaintenanceApp } from "./components/MaintenanceApp.jsx";
import { DevRoleSwitcher } from "./components/DevRoleSwitcher.jsx";
import { ReminderPanel } from "./components/ReminderPanel.jsx";
import { Modal } from "./components/ui/Modal.jsx";
import { PropertyForm } from "./components/PropertyForm.jsx";
import { createProperty, createTicket } from "./schema.js";
import { isFirebaseConfigured } from "./firebase.js";

export default function App() {
  const { t, toggleLang } = useI18n();
  const { user, authLoading, signingIn, signIn, signOutUser, isLocal } = useAuth();
  const { data, persist, update, loading, error, canEdit } = useData(user);
  const { role, tenantId, assigneeKey, demo, setDemo } = useRole(data, user, isLocal);

  const [view, setView] = useState("lobby"); // lobby | financial | maintenance | property
  const [currentPropertyId, setCurrentPropertyId] = useState(null);
  const [addPropertyOpen, setAddPropertyOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState(null); // { propertyId, ticketId|null }

  const ownerId = user?.uid || null;
  const currentProperty = useMemo(
    () => data.properties.find((p) => p.id === currentPropertyId) || null,
    [data.properties, currentPropertyId]
  );

  // ---- מסך כניסה (מצב ענן בלבד) ----
  if (isFirebaseConfigured && authLoading) {
    return <Centered>{t("common.loading")}</Centered>;
  }
  if (isFirebaseConfigured && !user) {
    return <LoginPage signIn={signIn} signingIn={signingIn} />;
  }
  if (loading) {
    return <Centered>{t("common.loading")}</Centered>;
  }

  // ---- פעולות נתונים (CRUD על המערכים; ownerId מוטבע בכל יצירה) ----
  const actions = {
    saveProperty: (p) =>
      update((d) => {
        const i = d.properties.findIndex((x) => x.id === p.id);
        if (i >= 0) d.properties[i] = { ...p, ownerId: p.ownerId || ownerId };
        else d.properties.push({ ...p, ownerId });
      }),
    saveTenant: (tenant, lease) =>
      update((d) => {
        const i = d.tenants.findIndex((x) => x.id === tenant.id);
        const withOwner = { ...tenant, ownerId: tenant.ownerId || ownerId };
        if (i >= 0) d.tenants[i] = withOwner;
        else d.tenants.push(withOwner);
        // אם אין חוזה עדיין — לא יוצרים אוטומטית; החוזה נוצר בטופס החוזה.
      }),
    saveLease: (lease) =>
      update((d) => {
        const i = d.leases.findIndex((x) => x.id === lease.id);
        const withOwner = { ...lease, ownerId: lease.ownerId || ownerId };
        if (i >= 0) d.leases[i] = withOwner;
        else d.leases.push(withOwner);
      }),
    saveTransaction: (tx) =>
      update((d) => {
        d.transactions.push({ ...tx, ownerId });
      }),
    deleteTransaction: (id) =>
      update((d) => {
        d.transactions = d.transactions.filter((x) => x.id !== id);
      }),
    saveDocument: (doc) =>
      update((d) => {
        d.documents.push({ ...doc, ownerId });
      }),
    deleteDocument: (id) =>
      update((d) => {
        d.documents = d.documents.filter((x) => x.id !== id);
      }),
    saveTicket: (tk) =>
      update((d) => {
        const i = d.tickets.findIndex((x) => x.id === tk.id);
        const withOwner = { ...tk, ownerId: tk.ownerId || ownerId };
        if (i >= 0) d.tickets[i] = withOwner;
        else d.tickets.push(withOwner);
      }),
    deleteTicket: (id) =>
      update((d) => {
        d.tickets = d.tickets.filter((x) => x.id !== id);
      }),
    openTicketForm: (propertyId, ticketId) => setTicketForm({ propertyId, ticketId }),

    // דייר מדווח תקלה — נוצרת ticket משויכת לנכס שלו (reportedByTenantId מוטבע במקור).
    reportTenantTicket: (tk) =>
      update((d) => {
        d.tickets.push({ ...tk, ownerId: tk.ownerId || ownerId });
      }),

    // איש תחזוקה מעדכן — מיזוג של status/fieldPhotos בלבד לתוך ה-ticket הקיים.
    // מקביל לבדיקת ה-diff ב-firestore.rules (כתיבה רק לשדות הללו).
    maintenanceUpdate: ({ id, status, fieldPhotos }) =>
      update((d) => {
        const i = d.tickets.findIndex((x) => x.id === id);
        if (i >= 0) d.tickets[i] = { ...d.tickets[i], status, fieldPhotos };
      }),

    // תזכורות (פרוסה 3) — הוספת תזכורת שמורה + שינוי סטטוס (טופל/התעלם).
    addReminder: (r) =>
      update((d) => {
        d.reminders.push({ ...r, ownerId: r.ownerId || ownerId });
      }),
    setReminderStatus: (id, status) =>
      update((d) => {
        const i = d.reminders.findIndex((x) => x.id === id);
        if (i >= 0) d.reminders[i] = { ...d.reminders[i], status };
      }),
  };

  const openProperty = (id) => {
    setCurrentPropertyId(id);
    setView("property");
  };

  // ---- ניתוב לפי תפקיד (פרוסה 2). owner ממשיך לזרימה הרגילה למטה. ----
  const withSwitcher = (screen) => (
    <div className="min-h-screen">
      {isLocal && <DevRoleSwitcher state={data} role={role} demo={demo} setDemo={setDemo} />}
      {screen}
    </div>
  );

  if (role === "tenant") {
    return withSwitcher(
      <TenantPortal
        state={data}
        tenantId={tenantId}
        ownerId={ownerId}
        onReportTicket={actions.reportTenantTicket}
        onToggleLang={toggleLang}
      />
    );
  }
  if (role === "maintenance") {
    return withSwitcher(
      <MaintenanceApp
        state={data}
        assigneeKey={assigneeKey}
        onUpdateTicket={actions.maintenanceUpdate}
        onToggleLang={toggleLang}
      />
    );
  }

  // ---- Onboarding gate (מסך 0) — בעלים בלבד ----
  const needsOnboarding = !data.settings.onboardingComplete && data.properties.length === 0;
  if (needsOnboarding) {
    return withSwitcher(
      <Onboarding
        ownerId={ownerId}
        onSkip={() =>
          persist({ ...data, settings: { ...data.settings, onboardingComplete: true } })
        }
        onComplete={({ property, portfolioSize, goTo }) => {
          // התמדה חד-פעמית בסיום: נכס (עם ownerId) + סימון onboarding כהושלם.
          persist({
            ...data,
            properties: property ? [...data.properties, { ...property, ownerId }] : data.properties,
            settings: {
              ...data.settings,
              onboardingComplete: true,
              portfolioSize: portfolioSize || data.settings.portfolioSize,
            },
          });
          if (goTo) {
            setCurrentPropertyId(goTo);
            setView("property");
          } else {
            setView("lobby");
          }
        }}
      />
    );
  }

  // ---- טופס תקלה (מסך 5) ----
  const ticketProperty = ticketForm ? data.properties.find((p) => p.id === ticketForm.propertyId) : null;
  const ticketInitial =
    ticketForm && ticketForm.ticketId
      ? data.tickets.find((tk) => tk.id === ticketForm.ticketId)
      : ticketForm
      ? createTicket({ ownerId, propertyId: ticketForm.propertyId })
      : null;

  return (
    <div className="min-h-screen">
      {isLocal && <DevRoleSwitcher state={data} role={role} demo={demo} setDemo={setDemo} />}
      <TopBar
        view={view}
        onNavigate={(v) => {
          setView(v);
          setCurrentPropertyId(null);
        }}
        onToggleLang={toggleLang}
        isLocal={isLocal}
        onSignOut={signOutUser}
      />

      {error && (
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{t(error)}</div>
        </div>
      )}

      {!canEdit && (
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">{t("common.viewer")}</div>
        </div>
      )}

      {isLocal && (
        <div className="mx-auto max-w-6xl px-4 pt-3">
          <div className="rounded-lg bg-slate-100 px-4 py-2 text-xs text-slate-600">
            <span className="font-semibold">{t("auth.localMode")}</span> — {t("auth.localModeHint")}
          </div>
        </div>
      )}

      <main>
        {view === "lobby" && (
          <Lobby
            data={data}
            canEdit={canEdit}
            onOpenProperty={openProperty}
            onAddProperty={() => setAddPropertyOpen(true)}
          />
        )}
        {view === "financial" && <FinancialDashboard data={data} onOpenProperty={openProperty} />}
        {view === "reminders" && (
          <ReminderPanel
            data={data}
            ownerId={ownerId}
            canEdit={canEdit}
            onOpenProperty={openProperty}
            onAddReminder={actions.addReminder}
            onSetStatus={actions.setReminderStatus}
          />
        )}
        {view === "maintenance" && (
          <MaintenanceDashboard
            data={data}
            onOpenProperty={openProperty}
            onNewTicket={() => {
              const first = data.properties[0];
              if (first) actions.openTicketForm(first.id, null);
            }}
            onEditTicket={(propertyId, ticketId) => actions.openTicketForm(propertyId, ticketId)}
          />
        )}
        {view === "property" && currentProperty && (
          <PropertyPage
            property={currentProperty}
            data={data}
            ownerId={ownerId}
            actions={actions}
            canEdit={canEdit}
            onBack={() => setView("lobby")}
          />
        )}
      </main>

      {/* הוספת נכס */}
      {addPropertyOpen && (
        <Modal title={t("lobby.addProperty")} wide onClose={() => setAddPropertyOpen(false)}>
          <PropertyForm
            initial={createProperty({ ownerId })}
            mode="full"
            onSubmit={(p) => {
              actions.saveProperty({ ...p, ownerId });
              setAddPropertyOpen(false);
              openProperty(p.id);
            }}
            onCancel={() => setAddPropertyOpen(false)}
          />
        </Modal>
      )}

      {/* טופס תקלה (מסך 5) */}
      {ticketForm && ticketInitial && (
        <TicketForm
          initial={ticketInitial}
          property={ticketProperty}
          onClose={() => setTicketForm(null)}
          onSave={(tk) => {
            actions.saveTicket(tk);
            setTicketForm(null);
          }}
        />
      )}
    </div>
  );
}

function Centered({ children }) {
  return <div className="flex min-h-screen items-center justify-center text-slate-500">{children}</div>;
}
