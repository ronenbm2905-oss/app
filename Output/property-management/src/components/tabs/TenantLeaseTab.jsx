import { useState } from "react";
import { useI18n } from "../../hooks/useI18n.jsx";
import { Button, Pill } from "../ui/Button.jsx";
import { Modal } from "../ui/Modal.jsx";
import { Field, Select, Checkbox } from "../ui/Field.jsx";
import { IconEdit, IconPlus, IconWhatsapp, IconPhone } from "../ui/icons.jsx";
import { enumOptions } from "../../utils/options.js";
import { LEASE_STATUSES, DEPOSIT_TYPES } from "../../constants.js";
import { createTenant, createLease } from "../../schema.js";
import { formatCurrency, formatDate, whatsappLink, telLink } from "../../utils/format.js";
import { activeLeaseFor, tenantById } from "../../utils/display.js";

// טאב דייר וחוזה. בפרוסה 1: דייר יחיד + חוזה יחיד לנכס (המודל תומך ביותר).
export function TenantLeaseTab({ property, data, ownerId, onSaveTenant, onSaveLease, onDeleteTenant, canEdit }) {
  const { t, lang } = useI18n();
  const [tenantModal, setTenantModal] = useState(false);
  const [leaseModal, setLeaseModal] = useState(false);

  const lease = activeLeaseFor(property.id, data.leases) || data.leases.find((l) => l.propertyId === property.id);
  const tenant = lease ? tenantById(lease.tenantId, data.tenants) : null;
  const c = property.currency;

  return (
    <div className="space-y-5">
      {/* דייר */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t("tenant.title")}</h3>
          {canEdit && (
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => setTenantModal(true)}>
                {tenant ? <IconEdit size={16} /> : <IconPlus size={16} />}
                {tenant ? t("common.edit") : t("tenant.add")}
              </Button>
              {/* B-RET: מחיקת דייר עם כל הנתונים המקושרים (זכות מחיקה). */}
              {tenant && onDeleteTenant && (
                <button
                  onClick={() => {
                    if (window.confirm(t("tenant.deleteConfirm"))) onDeleteTenant(tenant.id);
                  }}
                  className="text-xs font-medium text-red-600 hover:underline"
                >
                  {t("tenant.delete")}
                </button>
              )}
            </div>
          )}
        </div>
        {tenant ? (
          <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
            <Row label={t("tenant.fullName")} value={tenant.fullName} />
            <Row label={t("tenant.nationalId")} value={tenant.nationalId} />
            <Row
              label={t("tenant.phone")}
              value={
                tenant.phone ? (
                  <span className="flex items-center gap-2">
                    {tenant.phone}
                    <a href={whatsappLink(tenant.phone)} target="_blank" rel="noreferrer" className="text-green-600" aria-label={t("tenant.whatsapp")}>
                      <IconWhatsapp size={16} />
                    </a>
                    <a href={telLink(tenant.phone)} className="text-brand-600" aria-label={t("tenant.call")}>
                      <IconPhone size={16} />
                    </a>
                  </span>
                ) : "—"
              }
            />
            <Row label={t("tenant.email")} value={tenant.email} />
            <Row label={t("tenant.moveIn")} value={tenant.moveInDate ? formatDate(tenant.moveInDate, lang) : "—"} />
            {tenant.hasManager && <Row label={t("tenant.manager")} value={tenant.manager.name} />}
          </dl>
        ) : (
          <p className="text-sm text-slate-500">{t("tenant.none")}</p>
        )}
      </div>

      {/* חוזה */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-700">{t("lease.title")}</h3>
          {canEdit && (
            <Button variant="secondary" onClick={() => setLeaseModal(true)} disabled={!tenant}>
              {lease ? <IconEdit size={16} /> : <IconPlus size={16} />}
              {lease ? t("common.edit") : t("lease.add")}
            </Button>
          )}
        </div>
        {lease ? (
          <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-2">
            <Row label={t("lease.status")} value={<Pill tone={lease.status === "active" ? "green" : "slate"}>{t(`enum.leaseStatus.${lease.status}`)}</Pill>} />
            <Row label={t("lease.start")} value={lease.startDate ? formatDate(lease.startDate, lang) : "—"} />
            <Row label={t("lease.end")} value={lease.endDate ? formatDate(lease.endDate, lang) : "—"} />
            <Row label={t("lease.rent")} value={formatCurrency(lease.monthlyRent, c, lang)} />
            <Row label={t("lease.payDay")} value={lease.paymentDay || "—"} />
            <Row label={t("lease.deposit")} value={`${formatCurrency(lease.deposit.amount, c, lang)} (${t(`enum.depositType.${lease.deposit.type}`)})`} />
            <Row label={t("lease.guarantees")} value={lease.guarantees.count} />
            <Row label={t("lease.extension")} value={lease.extensionOption ? t("common.yes") : t("common.no")} />
          </dl>
        ) : (
          <p className="text-sm text-slate-500">{t("lease.none")}</p>
        )}
      </div>

      {tenantModal && (
        <TenantModal
          initial={tenant || createTenant({ ownerId })}
          onClose={() => setTenantModal(false)}
          onSave={(tn) => {
            onSaveTenant(tn, lease);
            setTenantModal(false);
          }}
        />
      )}
      {leaseModal && tenant && (
        <LeaseModal
          initial={lease || createLease({ ownerId, propertyId: property.id, tenantId: tenant.id })}
          onClose={() => setLeaseModal(false)}
          onSave={(ls) => {
            onSaveLease(ls);
            setLeaseModal(false);
          }}
        />
      )}
    </div>
  );
}

function TenantModal({ initial, onClose, onSave }) {
  const { t } = useI18n();
  const [tn, setTn] = useState(() => JSON.parse(JSON.stringify(initial)));
  const set = (k, v) => setTn({ ...tn, [k]: v });
  const setMgr = (k, v) => setTn({ ...tn, manager: { ...tn.manager, [k]: v } });
  return (
    <Modal
      title={t("tenant.title")}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(tn)}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label={t("tenant.fullName")} value={tn.fullName} onChange={(v) => set("fullName", v)} required />
        {/* B3 (מזעור): ת.ז. שדה אופציונלי בלבד — אין העלאת צילום ת.ז. */}
        <Field label={t("tenant.nationalId")} value={tn.nationalId} onChange={(v) => set("nationalId", v)} hint={t("common.optional")} />
        <Field label={t("tenant.phone")} value={tn.phone} onChange={(v) => set("phone", v)} />
        <Field label={t("tenant.email")} type="email" value={tn.email} onChange={(v) => set("email", v)} />
        <Field label={t("tenant.moveIn")} type="date" value={tn.moveInDate} onChange={(v) => set("moveInDate", v)} />
        <Checkbox label={t("tenant.hasManager")} checked={tn.hasManager} onChange={(v) => set("hasManager", v)} />
        {tn.hasManager && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label={t("tenant.manager")} value={tn.manager.name} onChange={(v) => setMgr("name", v)} />
            <Field label={t("tenant.phone")} value={tn.manager.phone} onChange={(v) => setMgr("phone", v)} />
          </div>
        )}
      </div>
    </Modal>
  );
}

function LeaseModal({ initial, onClose, onSave }) {
  const { t } = useI18n();
  const [ls, setLs] = useState(() => JSON.parse(JSON.stringify(initial)));
  const set = (k, v) => setLs({ ...ls, [k]: v });
  const num = (v) => (v === "" ? null : Number(v));
  return (
    <Modal
      title={t("lease.title")}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(ls)}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("lease.start")} type="date" value={ls.startDate} onChange={(v) => set("startDate", v)} />
          <Field label={t("lease.end")} type="date" value={ls.endDate} onChange={(v) => set("endDate", v)} />
          <Field label={t("lease.rent")} type="number" value={ls.monthlyRent ?? ""} onChange={(v) => set("monthlyRent", num(v))} />
          <Field label={t("lease.payDay")} type="number" value={ls.paymentDay ?? ""} onChange={(v) => set("paymentDay", num(v))} />
          <Field label={t("lease.deposit")} type="number" value={ls.deposit.amount ?? ""} onChange={(v) => set("deposit", { ...ls.deposit, amount: num(v) })} />
          <Select label={t("lease.depositType")} value={ls.deposit.type} onChange={(v) => set("deposit", { ...ls.deposit, type: v })} options={enumOptions(DEPOSIT_TYPES, "depositType", t)} />
          <Field label={t("lease.guarantees")} type="number" value={ls.guarantees.count ?? ""} onChange={(v) => set("guarantees", { ...ls.guarantees, count: num(v) })} />
          <Select label={t("lease.status")} value={ls.status} onChange={(v) => set("status", v)} options={enumOptions(LEASE_STATUSES, "leaseStatus", t)} />
        </div>
        <Checkbox label={t("lease.extension")} checked={ls.extensionOption} onChange={(v) => set("extensionOption", v)} />
      </div>
    </Modal>
  );
}

function Row({ label, value }) {
  const display = value === "" || value === null || value === undefined ? "—" : value;
  return (
    <div className="flex justify-between gap-4 border-b border-slate-50 py-1 text-sm">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-start font-medium text-slate-800">{display}</dd>
    </div>
  );
}
