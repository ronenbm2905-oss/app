import { useMemo, useState } from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";
import { useI18n } from "../hooks/useI18n.jsx";
import Button from "./ui/Button.jsx";
import Modal from "./ui/Modal.jsx";
import Field, { DateInput, Select, TextInput } from "./ui/Field.jsx";
import { NOTICE_METHODS, NOTICE_METHOD_DEFAULT } from "../constants.js";
import { validateNoticeDelivery } from "../utils/notice.js";
import { driverName } from "../utils/options.js";
import { formatDate } from "../utils/format.js";
import { todayIso } from "../utils/dates.js";

// ============================================================================
// NoticeDeliveryModal — רישום **אירוע מסירה** (שער עדי 16.8, 4.3).
//
// שלוש הדרישות שהמסך הזה מממש, וכולן ויזואליות בכוונה:
//   (א) **רשימת הנבחרים מוצגת לפני האישור.** אין "סמן הכל" עיוור — מי
//       שרושם ראיה על 29 בני אדם צריך לראות את 29 השמות.
//   (ב) **תאריך המסירה נשאל**, ולא נגזר מרגע הלחיצה. עתידי חסום.
//   (ג) **שיטת המסירה נבחרת מרשימה** מדורגת לפי חוזק הראיה.
//
// משמש גם למסלול הפר-נהג (רשימה בת נהג אחד) — כדי שלא תהיה דרך שנייה
// לכתוב את אותה ראיה, ושגם רישום בודד יקבל תאריך ושיטה אמיתיים.
// ============================================================================
export function NoticeDeliveryModal({ data, candidates, initialSelection = null, onClose, actions }) {
  const { t, lang } = useI18n();
  const today = todayIso();

  const list = useMemo(() => candidates || [], [candidates]);
  const [selected, setSelected] = useState(
    () => new Set(initialSelection || list.map((d) => d.id))
  );
  const [deliveredAt, setDeliveredAt] = useState(today);
  const [method, setMethod] = useState(NOTICE_METHOD_DEFAULT);
  const [evidenceRef, setEvidenceRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState([]);

  const policyVersion = data.settings?.policyVersion || null;
  const driverIds = useMemo(() => list.filter((d) => selected.has(d.id)).map((d) => d.id), [list, selected]);

  const validation = validateNoticeDelivery(
    { driverIds, policyVersion, method, deliveredAt },
    { today }
  );

  const toggle = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const submit = async () => {
    setErrors([]);
    if (validation.length) {
      setErrors(validation);
      return;
    }
    setBusy(true);
    const res = await actions.recordNoticeDelivery({
      driverIds,
      policyVersion,
      method,
      deliveredAt,
      evidenceRef: evidenceRef.trim() || null,
    });
    setBusy(false);
    if (!res?.ok) {
      setErrors(res?.errors?.length ? res.errors : ["notice.err.noDrivers"]);
      return;
    }
    onClose();
  };

  return (
    <Modal
      open
      wide
      onClose={onClose}
      title={t("notice.recordTitle")}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            {t("common.cancel")}
          </Button>
          <Button onClick={submit} disabled={busy || validation.length > 0}>
            <ShieldCheck size={14} /> {t("notice.confirm")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-slate-600">{t("notice.intro")}</p>

        {/* האיסור המפורש היחיד של עדי (4.3ב). הקוד חוסם עתיד; את העבר
            הוא אינו יכול לדעת, ולכן אומרים זאת ולא מעמידים פנים שנאכף. */}
        <p className="flex items-start gap-2 rounded border border-amber-300 bg-amber-50 p-2 text-[11px] text-amber-900">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>{t("notice.backdateWarning")}</span>
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("notice.deliveredAt")} hint={t("notice.deliveredAtHint")} required>
            <DateInput
              value={deliveredAt}
              max={today}
              onChange={(e) => setDeliveredAt(e.target.value)}
            />
          </Field>
          <Field label={t("notice.method")} hint={t("notice.methodHint")} required>
            <Select value={method} onChange={(e) => setMethod(e.target.value)}>
              {NOTICE_METHODS.map((m) => (
                <option key={m} value={m}>
                  {t(`notice.method.${m}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label={t("notice.evidenceRef")}
            hint={t("notice.evidenceRefHint")}
            className="sm:col-span-2"
          >
            <TextInput value={evidenceRef} onChange={(e) => setEvidenceRef(e.target.value)} />
          </Field>
        </div>

        {/* (א) — הרשימה עצמה. בחירה, לא סימון גורף. */}
        <div className="rounded border border-slate-200">
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 py-2">
            <span className="text-xs font-medium text-slate-700">{t("notice.selectTitle")}</span>
            <span className="num text-xs text-slate-500">
              {t("notice.selectedCount", { n: driverIds.length, total: list.length })}
            </span>
            <div className="ms-auto flex gap-1">
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set(list.map((d) => d.id)))}>
                {t("notice.selectAll")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
                {t("notice.clearAll")}
              </Button>
            </div>
          </div>
          {list.length ? (
            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto">
              {list.map((d) => {
                const on = selected.has(d.id);
                return (
                  <li key={d.id}>
                    <label className="flex cursor-pointer items-center gap-2 px-3 py-2 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(d.id)}
                        className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                      />
                      <span className="text-sm text-slate-800">
                        {driverName(data.drivers, d.id, "—", t)}
                      </span>
                      <span className="num ms-auto text-xs text-slate-500">
                        {[d.department, d.employeeNumber].filter(Boolean).join(" · ") || "—"}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-3 py-6 text-center text-sm text-slate-500">{t("notice.none")}</p>
          )}
        </div>

        {/* סיכום מפורש לפני האישור — מה בדיוק ייכתב. */}
        <p className="rounded border border-slate-200 bg-slate-50 p-2 text-xs text-slate-700">
          {driverIds.length
            ? t("notice.summary", {
                n: driverIds.length,
                version: policyVersion || "—",
                date: formatDate(deliveredAt, lang),
                method: t(`notice.method.${method}`),
              })
            : t("notice.summaryEmpty")}
        </p>

        {/* שגיאות ולידציה מוצגות מיד, לא רק אחרי לחיצה — "כפתור מכובה בלי
            הסבר" הוא בדיוק הכשל שעדי סימנה בשער הקנס. */}
        {[...new Set([...validation.filter((k) => k !== "notice.err.noDrivers"), ...errors])].map((k) => (
          <p key={k} className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            {t(k)}
          </p>
        ))}
      </div>
    </Modal>
  );
}

export default NoticeDeliveryModal;
