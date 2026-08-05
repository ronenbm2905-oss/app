import { useState } from "react";
import { useI18n } from "../hooks/useI18n.jsx";
import { Button, Pill } from "./ui/Button.jsx";
import { Modal } from "./ui/Modal.jsx";
import { Field, Select } from "./ui/Field.jsx";
import { IconPlus, IconCalendar, IconCheck, IconClose } from "./ui/icons.jsx";
import { enumOptions } from "../utils/options.js";
import { REMINDER_TYPES } from "../constants.js";
import { createReminder } from "../schema.js";
import { computeReminders, DEFAULT_LEAD_DAYS } from "../utils/reminders.js";
import { addressLine } from "../utils/display.js";
import { formatDate } from "../utils/format.js";

// מסך תזכורות (פרוסה 3). מציג תזכורות נגזרות (חידוש חוזה) + שמורות (ביטוח/מס/בדיקה),
// ממויינות לפי דחיפות, עם הדגשה של מה שבתוך חלון ההתראה. בלי push/מייל — תצוגה בלבד.
export function ReminderPanel({ data, ownerId, onOpenProperty, onAddReminder, onSetStatus, canEdit }) {
  const { t, lang } = useI18n();
  const [modal, setModal] = useState(false);
  const reminders = computeReminders(data);
  const propById = Object.fromEntries(data.properties.map((p) => [p.id, p]));
  const withinCount = reminders.filter((r) => r.within).length;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">{t("rem.title")}</h1>
          <p className="text-sm text-slate-500">{t("rem.count", { count: withinCount })}</p>
        </div>
        {canEdit && (
          <Button onClick={() => setModal(true)}>
            <IconPlus size={16} /> {t("rem.add")}
          </Button>
        )}
      </div>

      <p className="mb-3 text-xs text-slate-500">{t("rem.windowHint")}</p>

      {reminders.length === 0 ? (
        <div className="rounded-2xl bg-white p-10 text-center text-slate-500 shadow-sm">{t("rem.none")}</div>
      ) : (
        <ul className="space-y-2">
          {reminders.map((r) => {
            const prop = r.propertyId ? propById[r.propertyId] : null;
            return (
              <li
                key={r.id}
                className={`flex items-center justify-between rounded-2xl border p-4 shadow-sm ${
                  r.overdue
                    ? "border-red-200 bg-red-50"
                    : r.within
                    ? "border-amber-200 bg-amber-50"
                    : "border-transparent bg-white"
                }`}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <IconCalendar size={16} className="text-slate-400" />
                    <span className="font-medium text-slate-800">{t(`enum.reminderType.${r.type}`)}</span>
                    {r.source === "derived" && <Pill tone="slate">{t("rem.derived")}</Pill>}
                  </div>
                  <div className="mt-1 text-sm text-slate-500">
                    {formatDate(r.dueDate, lang)}
                    {prop && (
                      <button
                        onClick={() => onOpenProperty(prop.id)}
                        className="ms-2 text-brand-600 hover:underline"
                      >
                        {addressLine(prop)}
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${r.overdue ? "text-red-600" : r.within ? "text-amber-700" : "text-slate-500"}`}>
                    {r.daysUntil === 0
                      ? t("rem.today")
                      : r.overdue
                      ? t("rem.overdueDays", { days: Math.abs(r.daysUntil) })
                      : t("rem.inDays", { days: r.daysUntil })}
                  </span>
                  {canEdit && r.source === "stored" && (
                    <div className="flex gap-1">
                      <button onClick={() => onSetStatus(r.id, "done")} aria-label={t("rem.done")} className="rounded p-1 text-slate-400 hover:text-green-600">
                        <IconCheck size={16} />
                      </button>
                      <button onClick={() => onSetStatus(r.id, "dismissed")} aria-label={t("rem.dismiss")} className="rounded p-1 text-slate-400 hover:text-red-600">
                        <IconClose size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {modal && (
        <ReminderModal
          initial={createReminder({ ownerId, leadDays: DEFAULT_LEAD_DAYS })}
          properties={data.properties}
          onClose={() => setModal(false)}
          onSave={(r) => {
            onAddReminder(r);
            setModal(false);
          }}
        />
      )}
    </div>
  );
}

function ReminderModal({ initial, properties, onClose, onSave }) {
  const { t } = useI18n();
  const [r, setR] = useState(() => JSON.parse(JSON.stringify(initial)));
  const set = (k, v) => setR({ ...r, [k]: v });
  const propOptions = [
    { value: "", label: "—" },
    ...properties.map((p) => ({ value: p.id, label: addressLine(p) })),
  ];
  return (
    <Modal
      title={t("rem.add")}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>{t("common.cancel")}</Button>
          <Button onClick={() => onSave(r)}>{t("common.save")}</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Select label={t("rem.type")} value={r.type} onChange={(v) => set("type", v)} options={enumOptions(REMINDER_TYPES, "reminderType", t)} />
        <Field label={t("rem.dueDate")} type="date" value={r.dueDate} onChange={(v) => set("dueDate", v)} required />
        <Field label={t("rem.leadDays")} type="number" value={r.leadDays ?? ""} onChange={(v) => set("leadDays", v === "" ? null : Number(v))} />
        <Select label={t("rem.property")} value={r.propertyId || ""} onChange={(v) => set("propertyId", v || null)} options={propOptions} />
      </div>
    </Modal>
  );
}
