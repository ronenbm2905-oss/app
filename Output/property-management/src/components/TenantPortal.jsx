import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Button, Pill } from "./ui/Button.jsx";
import { Modal } from "./ui/Modal.jsx";
import { Select, Textarea } from "./ui/Field.jsx";
import { IconPlus, IconDoc, IconLang, IconWrench } from "./ui/icons.jsx";
import { enumOptions } from "../utils/options.js";
import { TICKET_TYPES } from "../constants.js";
import { createTicket } from "../schema.js";
import { tenantView } from "../utils/access.js";
import { addressLine } from "../utils/display.js";
import { formatCurrency, formatDate } from "../utils/format.js";
import { PrivacyPolicy } from "./PrivacyPolicy.jsx";

const STATUS_TONE = { open: "amber", inProgress: "blue", closed: "green" };

// מסך 6 — פורטל דייר. הדייר רואה אך ורק את הדירה שלו: חוזה, יתרה, תקלות שדיווח, מסמכים.
export function TenantPortal({ state, tenantId, ownerId, onReportTicket, onToggleLang }) {
  const { t, lang } = useI18n();
  const [reportOpen, setReportOpen] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const view = tenantView(state, tenantId);

  if (!view) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 text-center text-slate-500">
        {t("dev.noTenants")}
      </div>
    );
  }

  const { tenant, leases, properties, documents, tickets, openBalance } = view;
  const lease = leases.find((l) => l.status === "active") || leases[0];
  const property = properties[0];
  const currency = property?.currency || "ILS";

  return (
    <div>
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <div>
            <h1 className="text-lg font-bold text-slate-800">{t("portal.title")}</h1>
            <p className="text-xs text-slate-500">{t("portal.welcome", { name: tenant.fullName || "" })}</p>
          </div>
          <button onClick={onToggleLang} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={t("nav.language")}>
            <IconLang size={18} />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5">
        {/* B-AI-3: יידוע דייר על עיבוד ה-AI + קישור להודעת הפרטיות. */}
        <div className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
          <p>{t("portal.privacyNote")}</p>
          <p className="mt-1">{t("privacy.aiTenantNote")}</p>
          <button onClick={() => setPrivacy(true)} className="mt-1 font-medium underline">
            {t("privacy.link")}
          </button>
        </div>

        {/* הדירה שלי */}
        {property && (
          <Card title={t("portal.property")}>
            <div className="flex items-center justify-between">
              <span className="font-medium text-slate-800">{addressLine(property)}</span>
              <Pill tone="blue">{t(`enum.propertyType.${property.type}`)}</Pill>
            </div>
          </Card>
        )}

        {/* יתרת תשלומים */}
        <Card title={t("portal.balance")}>
          {openBalance > 0 ? (
            <span className="text-xl font-bold text-red-600">{formatCurrency(openBalance, currency, lang)}</span>
          ) : (
            <span className="text-sm text-green-700">{t("portal.balanceClear")}</span>
          )}
        </Card>

        {/* החוזה שלי */}
        <Card title={t("portal.myLease")}>
          {lease ? (
            <dl className="grid grid-cols-1 gap-y-1.5 text-sm sm:grid-cols-2">
              <Row label={t("lease.status")} value={<Pill tone={lease.status === "active" ? "green" : "slate"}>{t(`enum.leaseStatus.${lease.status}`)}</Pill>} />
              <Row label={t("lease.start")} value={lease.startDate ? formatDate(lease.startDate, lang) : "—"} />
              <Row label={t("lease.end")} value={lease.endDate ? formatDate(lease.endDate, lang) : "—"} />
              <Row label={t("lease.rent")} value={formatCurrency(lease.monthlyRent, currency, lang)} />
              <Row label={t("lease.payDay")} value={lease.paymentDay || "—"} />
            </dl>
          ) : (
            <p className="text-sm text-slate-500">{t("portal.noLease")}</p>
          )}
        </Card>

        {/* דיווח תקלה */}
        <Card
          title={t("portal.myTickets")}
          action={
            property && (
              <Button onClick={() => setReportOpen(true)}>
                <IconWrench size={16} /> {t("portal.reportIssue")}
              </Button>
            )
          }
        >
          {tickets.length === 0 ? (
            <p className="text-sm text-slate-500">{t("portal.noTickets")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {tickets.map((tk) => (
                <li key={tk.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-slate-700">
                    <span className="font-medium">{t(`enum.ticketType.${tk.type}`)}</span>
                    <span className="text-slate-400"> · {formatDate(tk.openedDate, lang)}</span>
                  </span>
                  <Pill tone={STATUS_TONE[tk.status]}>{t(`enum.ticketStatus.${tk.status}`)}</Pill>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* המסמכים שלי */}
        <Card title={t("portal.myDocs")}>
          {documents.length === 0 ? (
            <p className="text-sm text-slate-500">{t("portal.noDocs")}</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {documents.map((d) => (
                <li key={d.id} className="flex items-center gap-2 py-2 text-sm text-slate-700">
                  <IconDoc size={16} className="text-slate-400" />
                  <span className="font-medium">{t(`enum.docType.${d.type}`)}</span>
                  {d.fileName && <span className="text-slate-500">· {d.fileName}</span>}
                  <span className="text-slate-400">· {formatDate(d.uploadDate, lang)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </main>

      {reportOpen && property && (
        <ReportModal
          initial={createTicket({
            ownerId: property.ownerId || ownerId,
            propertyId: property.id,
            reportedByTenantId: tenantId,
          })}
          onClose={() => setReportOpen(false)}
          onSubmit={(tk) => {
            onReportTicket(tk);
            setReportOpen(false);
          }}
        />
      )}
      {privacy && <PrivacyPolicy mode="tenant" onClose={() => setPrivacy(false)} />}
    </div>
  );
}

function ReportModal({ initial, onClose, onSubmit }) {
  const { t } = useI18n();
  const [tk, setTk] = useState(() => JSON.parse(JSON.stringify(initial)));
  const set = (k, v) => setTk({ ...tk, [k]: v });
  return (
    <Modal
      title={t("portal.report.title")}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSubmit(tk)}>
            <IconPlus size={16} /> {t("portal.report.submit")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select label={t("tkt.type")} value={tk.type} onChange={(v) => set("type", v)} options={enumOptions(TICKET_TYPES, "ticketType", t)} />
        <Textarea label={t("tkt.description")} value={tk.description} onChange={(v) => set("description", v)} rows={4} />
      </div>
    </Modal>
  );
}

function Card({ title, action, children }) {
  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }) {
  const display = value === "" || value === null || value === undefined ? "—" : value;
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-800">{display}</dd>
    </div>
  );
}
