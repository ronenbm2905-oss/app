import { useState, useEffect } from "react";
import {
  PLAN_COLUMNS, UNIT_GROUPS, planKey, emptyPlan, normalizePlan,
  emptyRow, isFilled, buildPlan, planSummary,
} from "../utils/trainingPlan";
import { IconClipboard, IconPlus, IconTrash, IconCheck } from "./ui/icons";

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleString("he-IL", { day: "numeric", month: "numeric", hour: "2-digit", minute: "2-digit" });
};

const cell =
  "w-full px-2 py-1.5 text-sm bg-white border border-stone-200 rounded focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500";

// Saving trims the blank tail, so a plan read back has no room left to write in. Opening
// one always ends on an empty row, which is what the paper form gave the coach for free.
const withBlankRow = (plan) => {
  const p = normalizePlan(plan);
  const last = p.rows[p.rows.length - 1];
  const spent = last && PLAN_COLUMNS.some((c) => last[c.id]);
  return spent ? { ...p, rows: [...p.rows, emptyRow()] } : p;
};
// The training-plan form the club fills on paper, for one session.
//
// Closed by default: a coach opens the form for the training they are about to run, not
// for all four on the screen. The header line the paper form asks for — team, date, hall —
// is filled from the schedule instead of being typed again.
export function TrainingPlanForm({ session, teamName, hallName, dateLabel, plans, savePlan, authorName }) {
  const key = planKey(session);
  const saved = plans?.[key];
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => withBlankRow(saved || emptyPlan()));
  const [savedAt, setSavedAt] = useState("");

  // Follow the stored plan when it changes underneath us — another device, or a first
  // load that arrived after this row rendered — but never while the form is open, which
  // would overwrite what the coach is in the middle of typing.
  useEffect(() => {
    if (!open) setDraft(withBlankRow(saved || emptyPlan()));
  }, [saved, open]);

  if (!key) return null;

  const filled = isFilled(saved);
  const setField = (field, value) => setDraft((d) => ({ ...d, [field]: value }));
  const setCell = (i, col, value) =>
    setDraft((d) => ({ ...d, rows: d.rows.map((r, j) => (j === i ? { ...r, [col]: value } : r)) }));
  const setUnit = (group, kind, i, value) =>
    setDraft((d) => ({
      ...d,
      units: { ...d.units, [group]: { ...d.units[group], [kind]: d.units[group][kind].map((v, j) => (j === i ? value : v)) } },
    }));

  const onSave = () => {
    const now = new Date().toISOString();
    savePlan(key, buildPlan(saved, { plan: draft, author: authorName, now }));
    setSavedAt(now);
    setOpen(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium rounded-md px-2 py-1 border ${
          filled
            ? "text-brand-800 bg-brand-100 border-brand-200 hover:bg-brand-200"
            : "text-stone-600 bg-white border-stone-200 hover:bg-stone-50"
        }`}
      >
        <IconClipboard size={12} />
        {filled ? planSummary(saved) : "מלא מערך אימון"}
        {filled && <IconCheck size={12} className="text-brand-600" />}
      </button>
    );
  }

  return (
    <div className="mt-2 bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="bg-stone-50 px-3 py-2 border-b border-stone-200">
        <h4 className="text-sm font-semibold text-stone-800">מערך אימון</h4>
        {/* The header line the paper form asks the coach to fill by hand. The schedule
            already knows all of it, so it is shown rather than asked for. */}
        <p className="text-xs text-stone-600 mt-0.5">
          {[teamName, dateLabel, hallName].filter(Boolean).join(" · ")}
        </p>
      </div>

      <div className="p-3 space-y-4">
        <div className="grid sm:grid-cols-2 gap-2">
          <label className="block">
            <span className="text-xs font-medium text-stone-600">מס׳ שחקנים</span>
            <input
              className={cell}
              inputMode="numeric"
              value={draft.players}
              onChange={(e) => setField("players", e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-xs font-medium text-stone-600">חסרים</span>
            <input
              className={cell}
              value={draft.missing}
              onChange={(e) => setField("missing", e.target.value)}
            />
            {/* A name is roster data; a name with a reason beside it is health data about
                a minor. The line below is the whole difference. */}
            <span className="text-[11px] text-stone-500">מספר או שמות בלבד — בלי סיבת ההיעדרות</span>
          </label>
        </div>

        <div>
          {/* The table scrolls inside itself: four columns of free text do not fit a phone,
              and letting the page scroll sideways instead would move the whole screen. */}
          <div className="overflow-x-auto -mx-1 px-1">
            <table className="w-full min-w-[34rem] border-collapse">
              <thead>
                <tr>
                  {PLAN_COLUMNS.map((c) => (
                    <th
                      key={c.id}
                      className={`text-right text-xs font-semibold text-stone-600 pb-1 ${c.id === "time" ? "w-16" : ""}`}
                    >
                      {c.label}
                    </th>
                  ))}
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {draft.rows.map((row, i) => (
                  <tr key={i}>
                    {PLAN_COLUMNS.map((c) => (
                      <td key={c.id} className="p-0.5 align-top">
                        <input
                          className={cell}
                          value={row[c.id]}
                          onChange={(e) => setCell(i, c.id, e.target.value)}
                          aria-label={`${c.label}, שורה ${i + 1}`}
                        />
                      </td>
                    ))}
                    <td className="p-0.5 align-top">
                      <button
                        type="button"
                        onClick={() => setDraft((d) => ({ ...d, rows: d.rows.filter((_, j) => j !== i) }))}
                        className="p-1.5 text-stone-500 hover:text-red-600"
                        aria-label={`מחק שורה ${i + 1}`}
                      >
                        <IconTrash size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setDraft((d) => ({ ...d, rows: [...d.rows, emptyRow()] }))}
            className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-900"
          >
            <IconPlus size={12} /> הוסף שורה
          </button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          {UNIT_GROUPS.map((g) => (
            <div key={g} className="border border-stone-200 rounded-lg p-2">
              <p className="text-xs font-semibold text-stone-600 mb-1.5">הרכבים {g}</p>
              <div className="space-y-1">
                {draft.units[g].quads.map((v, i) => (
                  <label key={`q${i}`} className="flex items-center gap-2">
                    <span className="text-xs text-stone-600 w-16 shrink-0">רביעייה {i + 1}</span>
                    <input className={cell} value={v} onChange={(e) => setUnit(g, "quads", i, e.target.value)} />
                  </label>
                ))}
                {draft.units[g].fives.map((v, i) => (
                  <label key={`f${i}`} className="flex items-center gap-2">
                    <span className="text-xs text-stone-600 w-16 shrink-0">חמישייה {i + 1}</span>
                    <input className={cell} value={v} onChange={(e) => setUnit(g, "fives", i, e.target.value)} />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>

        <label className="block">
          <span className="text-xs font-medium text-stone-600">סיכום ונקודות חשובות לאימון הבא</span>
          <textarea
            rows={3}
            className={`${cell} resize-y`}
            value={draft.summary}
            onChange={(e) => setField("summary", e.target.value)}
          />
        </label>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="text-xs font-medium text-stone-600 px-3 py-1.5 rounded-md border border-stone-200 hover:bg-stone-50"
          >
            סגור
          </button>
          <button
            type="button"
            onClick={onSave}
            className="text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 px-3 py-1.5 rounded-md"
          >
            שמור
          </button>
          {(savedAt || saved?.updatedAt) && (
            <span className="text-xs text-stone-500">
              נשמר {when(savedAt || saved.updatedAt)}
              {saved?.author ? ` · ${saved.author}` : ""}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
