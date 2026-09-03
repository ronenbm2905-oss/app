import { useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { EditableField } from "./ui/EditableField.jsx";
import { IconNote, IconWarning } from "./ui/icons.jsx";
import { NOTE_KIND_LABEL, EXPENSE_CATEGORIES } from "../constants.js";
import { classifyNote, reviewSummary, planStripAuthorPrefixes } from "../utils/notesReview.js";

/**
 * סבב מיון של 212 ההערות שהועתקו מהאקסל.
 *
 * ⚠ דגל B5 של עדי, חוסם לפני הסנכרון הראשון: תוכן ההערות **אינו מוגדר** —
 * ידוע שיש שם טלפונים, וייתכנו שמות דיירים והערכות אישיות על ספקים. הערה היא
 * מידע שאדם זכאי לעיין בו, והיא חשופה לטענת לשון הרע.
 *
 * המסך **מסמן ומדרג, לא מוחק**. סיווג אוטומטי שמוחק היה מוחק גם את מה שלא
 * הבין. הפעולה האוטומטית היחידה היא הסרת הקידומת ״USER:״ — ארטיפקט של אקסל,
 * לא תוכן שמישהו כתב.
 */
export default function NotesReview({ data, readOnly = false, update, remove, applyBatch, onOpenBuilding }) {
  const [filter, setFilter] = useState("flagged");
  const [confirmId, setConfirmId] = useState(null);

  const addressById = useMemo(
    () => new Map(data.buildings.map((b) => [b.id, b.address])),
    [data.buildings]
  );
  const summary = useMemo(() => reviewSummary(data.notes), [data.notes]);

  const rows = useMemo(() => {
    return data.notes
      .map((n) => ({ note: n, ...classifyNote(n) }))
      .filter((r) =>
        filter === "all" ? true
        : filter === "phone" ? r.hasPhone
        : filter === "flagged" ? r.severity > 0
        : true)
      .sort((a, b) => b.severity - a.severity);
  }, [data.notes, filter]);

  const prefixPlan = useMemo(() => planStripAuthorPrefixes(data.notes), [data.notes]);

  const Chip = ({ id, label, count, tone = "slate" }) => (
    <button onClick={() => setFilter(id)}
      className={`rounded-lg border px-3 py-1.5 text-sm transition ${
        filter === id ? "border-slate-900 bg-slate-900 text-white"
        : tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100"
        : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
      {label} <span className="tnum opacity-70">{count}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 py-6">
      <div className="card border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-2">
          <IconWarning className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
          <div className="text-sm leading-relaxed text-amber-900">
            <b>עבור על ההערות לפני שהן עולות לענן.</b> {summary.total} הערות
            הועתקו מהאקסל כפי שהן, ואיש לא קרא מה כתוב בהן.{" "}
            {summary.withPhone > 0 && <><b>{summary.withPhone} מכילות מספר שנראה כמו טלפון.</b>{" "}</>}
            הערה היא מידע שאדם זכאי לעיין בו, והיא חשופה לטענת לשון הרע — ולכן
            מה שלא נחוץ, עדיף למחוק עכשיו. אחרי הסנכרון זו עבודה על שני מחשבים
            מול נתונים חיים.
          </div>
        </div>
      </div>

      <div className="card p-3">
        <div className="flex flex-wrap items-center gap-2">
          <Chip id="flagged" label="מסומנות לבדיקה" count={summary.withPhone + summary.freeformLong} tone="amber" />
          <Chip id="phone" label="עם טלפון" count={summary.withPhone} tone="amber" />
          <Chip id="all" label="כל ההערות" count={summary.total} />
        </div>
        {prefixPlan.updates.length > 0 && !readOnly && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
            <span className="text-sm text-slate-600">
              ל-{prefixPlan.updates.length} הערות יש קידומת ״USER:״ — שארית של אקסל, לא תוכן.
            </span>
            <Button onClick={() => applyBatch("notes", prefixPlan)}>ניקוי הקידומת בכולן</Button>
          </div>
        )}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3">
          <IconNote className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-700">{rows.length} הערות</h2>
          <span className="text-xs text-slate-500">לחיצה על הטקסט פותחת לעריכה</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {rows.map((r) => (
            <li key={r.note.id} className={`px-4 py-3 ${r.hasPhone ? "bg-amber-50/60" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[11px] font-medium text-slate-600">
                  {NOTE_KIND_LABEL[r.note.kind] || r.note.kind}
                </span>
                {addressById.has(r.note.buildingId) && (
                  <button onClick={() => onOpenBuilding(r.note.buildingId)}
                    className="text-xs text-slate-600 hover:underline">
                    {addressById.get(r.note.buildingId)}
                  </button>
                )}
                {r.note.categoryId && (
                  <span className="text-xs text-slate-500">
                    {EXPENSE_CATEGORIES.find((c) => c.id === r.note.categoryId)?.name}
                  </span>
                )}
                {r.flags.map((f) => (
                  <span key={f} className="rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                    {f}
                  </span>
                ))}
                <span className="text-[11px] text-slate-300">{r.note.sourceCell}</span>
                {!readOnly && (
                  <button onClick={() => setConfirmId(confirmId === r.note.id ? null : r.note.id)}
                    className="ms-auto text-xs text-red-600 hover:underline">
                    מחיקה
                  </button>
                )}
              </div>
              <div className="mt-1">
                <EditableField
                  value={r.note.text}
                  readOnly={readOnly}
                  placeholder="(ריק)"
                  className="w-full text-sm leading-snug"
                  onSave={(v) => update("notes", r.note.id, { text: v })}
                />
              </div>
              {confirmId === r.note.id && (
                <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
                  <span>למחוק את ההערה? אין ביטול.</span>
                  <Button variant="danger" onClick={() => { remove("notes", r.note.id); setConfirmId(null); }}>
                    מחיקה
                  </Button>
                  <Button onClick={() => setConfirmId(null)}>ביטול</Button>
                </div>
              )}
            </li>
          ))}
          {rows.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-slate-400">
              אין הערות בסינון הזה — אם ״מסומנות לבדיקה״ ריק, הסבב הושלם.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
