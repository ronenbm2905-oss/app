import { useState } from "react";
import { Button } from "./ui/Button.jsx";
import { Field, Select } from "./ui/Field.jsx";
import { IconInfo, IconWarning } from "./ui/icons.jsx";
import { fmtILS } from "../utils/money.js";
import { monthLabel, monthRange } from "../utils/dates.js";
import { makeProject } from "../schema.js";
import { DELAY_SCENARIOS } from "../constants.js";

/**
 * הגדרות הפרויקט. עד עכשיו השדות האלה הגיעו רק דרך הייבוא, כך שמספר כמו
 * יתרת הפתיחה — שמשנה את כל תמונת התזרים — לא היה ניתן לתיקון בממשק.
 */
export default function ProjectSettings({ project, store, canEdit }) {
  const [form, setForm] = useState(project);
  const [saved, setSaved] = useState(false);

  const set = (patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setSaved(false);
  };

  const dirty = JSON.stringify(makeProject(form)) !== JSON.stringify(makeProject(project));

  const save = () => {
    store.upsert("projects", makeProject(form));
    setSaved(true);
  };

  const months =
    form.startMonth && form.endMonth && form.endMonth >= form.startMonth
      ? monthRange(form.startMonth, form.endMonth).length
      : 0;

  return (
    <div className="max-w-3xl">
      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Field label="שם הפרויקט" value={form.name} onChange={(v) => set({ name: v })} disabled={!canEdit} />
        <Field label="כתובת" value={form.address} onChange={(v) => set({ address: v })} disabled={!canEdit} />

        <Field
          label="שם הרשות המחזירה"
          value={form.taxAuthorityName}
          onChange={(v) => set({ taxAuthorityName: v })}
          disabled={!canEdit}
          hint="מופיע בכל המסכים ובדוח ההגשה"
        />
        <Field
          label="שיעור מע״מ"
          type="number"
          value={form.vatRate}
          onChange={(v) => set({ vatRate: Number(v) })}
          disabled={!canEdit}
          hint="0.18 = 18%"
        />

        <Field
          label="חודש התחלה"
          type="month"
          value={form.startMonth || ""}
          onChange={(v) => set({ startMonth: v || null })}
          disabled={!canEdit}
        />
        <Field
          label="חודש סיום"
          type="month"
          value={form.endMonth || ""}
          onChange={(v) => set({ endMonth: v || null })}
          disabled={!canEdit}
          hint={months ? `${months} חודשי תזרים` : "טווח לא תקין"}
        />
      </div>

      <section className="mb-5 rounded-lg border border-border bg-surface-alt p-4">
        <h3 className="mb-1 text-sm font-semibold text-ink-body">כסף</h3>
        <p className="mb-3 text-xs text-ink-muted">
          שלושת המספרים שמשנים את תמונת התזרים והזכאות.
        </p>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field
            label="יתרת פתיחה בקופה"
            type="number"
            value={form.openingCash}
            onChange={(v) => set({ openingCash: Number(v) })}
            disabled={!canEdit}
            hint="הכסף שכבר בקופה בחודש הראשון"
          />
          <Field
            label={`תקרת החזר מ${form.taxAuthorityName}`}
            type="number"
            value={form.entitlementCap}
            onChange={(v) => set({ entitlementCap: Number(v) })}
            disabled={!canEdit}
          />
          <Field
            label="התקבל כמקדמה"
            type="number"
            value={form.entitlementReceived}
            onChange={(v) => set({ entitlementReceived: Number(v) })}
            disabled={!canEdit}
            hint="מנוכה מיתרת הזכאות"
          />
        </div>
        <p className="mt-3 text-sm text-ink-muted">
          יתרת זכאות נותרת:{" "}
          <span className="num font-semibold text-navy">
            {fmtILS((Number(form.entitlementCap) || 0) - (Number(form.entitlementReceived) || 0))}
          </span>
        </p>
      </section>

      <div className="mb-5 grid gap-4 sm:grid-cols-2">
        <Select
          label="פיגור צפוי בהחזר"
          value={String(form.refundLagDays)}
          onChange={(v) => set({ refundLagDays: Number(v) })}
          options={[0, ...DELAY_SCENARIOS.filter(Boolean)].map((d) => ({
            value: String(d),
            label: `${d} יום`,
          }))}
          disabled={!canEdit}
        />
        <Field
          label="חודשי עבודה"
          type="number"
          value={form.workMonths ?? ""}
          onChange={(v) => set({ workMonths: v === "" ? null : Number(v) })}
          disabled={!canEdit}
        />
      </div>

      {project.notes?.length > 0 && (
        <section className="mb-5 rounded-lg border border-border bg-white p-4">
          <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-ink-body">
            <IconInfo size={15} /> הערות שיובאו מהגיליון
          </h3>
          <ul className="list-inside list-disc space-y-1 text-xs text-ink-muted">
            {project.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {canEdit && (
        <div className="flex items-center gap-3">
          <Button onClick={save} disabled={!dirty}>
            שמירה
          </Button>
          {saved && !dirty && <span className="text-sm text-success-text">נשמר</span>}
          {dirty && (
            <span className="flex items-center gap-1.5 text-sm text-warning-text">
              <IconWarning size={15} /> יש שינויים שלא נשמרו
            </span>
          )}
        </div>
      )}
    </div>
  );
}
