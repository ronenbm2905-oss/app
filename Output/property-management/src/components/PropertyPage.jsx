import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Pill } from "./ui/Button.jsx";
import { IconArrowRight, IconArrowLeft, IconYield } from "./ui/icons.jsx";
import { GeneralTab } from "./tabs/GeneralTab.jsx";
import { TenantLeaseTab } from "./tabs/TenantLeaseTab.jsx";
import { FinanceTab } from "./tabs/FinanceTab.jsx";
import { MaintenanceTab } from "./tabs/MaintenanceTab.jsx";
import { DocumentsTab } from "./tabs/DocumentsTab.jsx";
import { addressLine } from "../utils/display.js";
import { formatPercent } from "../utils/format.js";
import { computeYield } from "../utils/finance.js";

const TABS = ["general", "tenant", "finance", "maintenance", "documents"];

// מסך 4 — דף נכס עם כותרת קבועה + 5 טאבים.
export function PropertyPage({ property, data, ownerId, actions, canEdit, onBack }) {
  const { t, lang, dir } = useI18n();
  const [tab, setTab] = useState("general");
  const y = computeYield(property, data.transactions, data.leases);
  const BackIcon = dir === "rtl" ? IconArrowRight : IconArrowLeft;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      {/* כותרת קבועה */}
      <button onClick={onBack} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
        <BackIcon size={16} /> {t("nav.back")}
      </button>

      <div className="mb-5 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-800">{addressLine(property)}</h1>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              <span>{t(`enum.propertyType.${property.type}`)}</span>
              <Pill tone="blue">{t(`enum.propertyStatus.${property.status}`)}</Pill>
            </div>
          </div>
          <div className="rounded-xl bg-brand-50 px-4 py-2 text-center">
            <div className="flex items-center gap-1 text-xs text-brand-600">
              <IconYield size={14} /> {t("prop.yield")}
            </div>
            <div className="text-lg font-bold text-brand-700">{formatPercent(y, lang)}</div>
          </div>
        </div>
      </div>

      {/* טאבים */}
      <div role="tablist" className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium transition ${
              tab === key
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t(`prop.tab.${key}`)}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {tab === "general" && (
          <GeneralTab property={property} onSave={actions.saveProperty} canEdit={canEdit} />
        )}
        {tab === "tenant" && (
          <TenantLeaseTab
            property={property}
            data={data}
            ownerId={ownerId}
            onSaveTenant={actions.saveTenant}
            onSaveLease={actions.saveLease}
            canEdit={canEdit}
          />
        )}
        {tab === "finance" && (
          <FinanceTab
            property={property}
            data={data}
            ownerId={ownerId}
            onSave={actions.saveTransaction}
            onDelete={actions.deleteTransaction}
            canEdit={canEdit}
          />
        )}
        {tab === "maintenance" && (
          <MaintenanceTab
            property={property}
            data={data}
            onNewTicket={() => actions.openTicketForm(property.id, null)}
            onEditTicket={(id) => actions.openTicketForm(property.id, id)}
            onDelete={actions.deleteTicket}
            canEdit={canEdit}
          />
        )}
        {tab === "documents" && (
          <DocumentsTab
            property={property}
            data={data}
            ownerId={ownerId}
            onSave={actions.saveDocument}
            onDelete={actions.deleteDocument}
            canEdit={canEdit}
          />
        )}
      </div>
    </div>
  );
}
