import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Modal } from "./ui/Modal.jsx";
import { Button } from "./ui/Button.jsx";
import { Field, Select, Checkbox, Textarea } from "./ui/Field.jsx";
import { enumOptions } from "../utils/options.js";
import { TICKET_TYPES, TICKET_STATUSES, MEMBER_STATUSES } from "../constants.js";
import { addressLine } from "../utils/display.js";

// מסך 5 — פתיחת/עריכת תקלה. זרימה: סוג → תיאור → מטפל → סטטוס → הצעת מחיר →
// עלות סופית → ביטוח. מוצג כמודאל מעל דף הנכס או הדשבורד.
export function TicketForm({ initial, property, onSave, onClose }) {
  const { t } = useI18n();
  const [tk, setTk] = useState(() => JSON.parse(JSON.stringify(initial)));
  const set = (k, v) => setTk({ ...tk, [k]: v });
  const setHandler = (k, v) => setTk({ ...tk, handler: { ...tk.handler, [k]: v } });
  const setInsurance = (k, v) => setTk({ ...tk, insurance: { ...tk.insurance, [k]: v } });
  const num = (v) => (v === "" ? null : Number(v));
  const isEdit = Boolean(initial.description || initial.handler?.name);

  return (
    <Modal
      title={isEdit ? t("tkt.edit") : t("tkt.new")}
      wide
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(tk)}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-4">
        {property && (
          <div className="text-sm text-slate-500">
            {t("tkt.property")}: <span className="font-medium text-slate-700">{addressLine(property)}</span>
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Select label={t("tkt.type")} value={tk.type} onChange={(v) => set("type", v)} options={enumOptions(TICKET_TYPES, "ticketType", t)} />
          <Field label={t("tkt.opened")} type="date" value={tk.openedDate} onChange={(v) => set("openedDate", v)} />
        </div>
        <Textarea label={t("tkt.description")} value={tk.description} onChange={(v) => set("description", v)} rows={3} />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label={t("tkt.handlerName")} value={tk.handler.name} onChange={(v) => setHandler("name", v)} />
          <Field label={t("tkt.handlerPhone")} value={tk.handler.phone} onChange={(v) => setHandler("phone", v)} />
          <Select label={t("tkt.status")} value={tk.status} onChange={(v) => set("status", v)} options={enumOptions(TICKET_STATUSES, "ticketStatus", t)} />
          <Field label={t("tkt.quote")} type="number" value={tk.quote ?? ""} onChange={(v) => set("quote", num(v))} />
          <Field label={t("tkt.cost")} type="number" value={tk.cost ?? ""} onChange={(v) => set("cost", num(v))} />
          <Field label={t("tkt.deductible")} type="number" value={tk.insurance.deductible ?? ""} onChange={(v) => setInsurance("deductible", num(v))} disabled={!tk.insurance.used} />
        </div>
        <div className="flex flex-wrap gap-4">
          <Checkbox label={t("tkt.warranty")} checked={tk.underWarranty} onChange={(v) => set("underWarranty", v)} />
          <Checkbox label={t("tkt.insurance")} checked={tk.insurance.used} onChange={(v) => setInsurance("used", v)} />
        </div>

        {/* שיוך לצוות תחזוקה (פרוסה 2) — שדה email + סטטוס (שלד הזמנה) */}
        <fieldset className="rounded-xl border border-slate-200 p-4">
          <legend className="px-2 text-sm font-semibold text-slate-700">{t("tkt.assignee")}</legend>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field
              label={t("tkt.assigneeEmail")}
              type="email"
              value={tk.assigneeEmail}
              onChange={(v) => set("assigneeEmail", v)}
            />
            <Select
              label={t("tkt.assigneeStatus")}
              value={tk.assigneeStatus}
              onChange={(v) => set("assigneeStatus", v)}
              options={enumOptions(MEMBER_STATUSES, "memberStatus", t)}
            />
          </div>
        </fieldset>
      </div>
    </Modal>
  );
}
