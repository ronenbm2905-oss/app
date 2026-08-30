import { useMemo, useState } from "react";
import { Button } from "./ui/Button.jsx";
import { fmtILSExact } from "../utils/money.js";
import { fmtDate, todayISO } from "../utils/dates.js";
import { planPriceChange, canDeleteEntry, sortByEffective, PRICE_MODE_LABEL } from "../utils/pricing.js";

/**
 * עורך מחיר — משותף לחוזה שירות ולדמי ניהול.
 *
 * שניהם `{ amount, effectiveFrom }`, ולכן רכיב אחד. שני עורכים נפרדים היו
 * נפרדים גם בהתנהגות ברגע שאחד מהם מתוקן והשני לא.
 *
 * העיקרון: **״תיקון״ ו״מחיר חדש״ הן שתי פעולות שונות.** טעות הקלדה אינה שינוי
 * מחיר. אילו כל עריכה הייתה יוצרת שורת היסטוריה, ההיסטוריה הייתה מתמלאת
 * בתיקוני הקלדה; אילו אף אחת לא הייתה — היינו חוזרים לדריסה שהייתה כאן קודם.
 *
 * שום דבר לא נשמר עד לחיצה על ״שמירה״: `planPriceChange` מחזירה תוכנית,
 * והמסך מציג אותה במילים. שינוי רטרואקטיבי משנה מספרים שכבר דווחו — הוא
 * חייב להיות ניתן לבדיקה מראש.
 */
export default function PriceEditor({
  title,
  entries,          // כל ההיסטוריה של החוזה/הבניין
  current,          // הרשומה התקפה היום
  template,         // שדות שיועתקו לשורה חדשה (buildingId, categoryId, …)
  collection,       // "contracts" | "feeAgreements"
  allowNull = true, // חוזה: שדה ריק = הוועד משלם. דמי ניהול: לא.
  onApply,          // (collection, { updates, creates }) => void
  onDelete,         // (collection, id) => void
  onClose,
}) {
  const asOf = todayISO();
  const [amount, setAmount] = useState(current?.amount ?? "");
  const [mode, setMode] = useState("newPrice");
  const [effectiveFrom, setEffectiveFrom] = useState(asOf);

  const history = useMemo(() => sortByEffective(entries), [entries]);

  const parsed = useMemo(() => {
    const t = String(amount).trim();
    if (t === "") return allowNull ? null : NaN;
    return Number(t.replace(/,/g, ""));
  }, [amount, allowNull]);

  const plan = useMemo(
    () => planPriceChange({
      entries, currentId: current?.id ?? null, newAmount: parsed,
      mode, effectiveFrom, template, asOf,
    }),
    [entries, current, parsed, mode, effectiveFrom, template, asOf]
  );

  const apply = () => {
    if (plan.error) return;
    onApply(collection, { updates: plan.updates, creates: plan.creates });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-16"
      onClick={onClose}>
      <div className="card w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button className="text-xs text-slate-500 hover:underline" onClick={onClose}>סגירה</button>
        </div>

        <div className="mt-1 text-xs text-slate-500">
          המחיר התקף היום:{" "}
          <b className="tnum">{current?.amount == null ? "— ללא סכום" : fmtILSExact(current.amount)}</b>
          {current?.effectiveFrom && <> · מ-{fmtDate(current.effectiveFrom)}</>}
        </div>

        {/* --- סכום --- */}
        <label className="mt-4 block text-xs text-slate-600">
          סכום חודשי
          <input
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !plan.error) apply(); if (e.key === "Escape") onClose(); }}
            className="mt-1 block w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm tnum"
            placeholder={allowNull ? "ריק = הוועד משלם" : ""}
            aria-label="סכום חודשי חדש"
          />
        </label>

        {/* --- מצב העריכה: ההכרעה המרכזית של המסך --- */}
        <fieldset className="mt-4">
          <legend className="text-xs text-slate-600">סוג השינוי</legend>
          <div className="mt-1 space-y-1.5">
            {["newPrice", "correct"].map((m) => (
              <label key={m} className="flex cursor-pointer items-start gap-2 text-sm">
                <input type="radio" name="price-mode" value={m} checked={mode === m}
                  onChange={() => setMode(m)} className="mt-1" />
                <span className="text-slate-700">{PRICE_MODE_LABEL[m]}</span>
              </label>
            ))}
          </div>
        </fieldset>

        {mode === "newPrice" && (
          <label className="mt-3 block text-xs text-slate-600">
            בתוקף מתאריך
            <input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-1.5 text-sm tnum"
              aria-label="תאריך תחולה" />
          </label>
        )}

        {/* --- מה יקרה --- */}
        <div className="mt-4 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed">
          {plan.error ? (
            <span className="text-red-700">{plan.error}</span>
          ) : (
            <>
              <div className="text-slate-700"><b>מה יקרה:</b> {plan.preview}</div>
              {plan.warning && <div className="mt-1 text-amber-700">⚠ {plan.warning}</div>}
            </>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <Button variant="primary" disabled={!!plan.error} onClick={apply}>שמירה</Button>
          <Button onClick={onClose}>ביטול</Button>
        </div>

        {/* --- היסטוריה --- */}
        <div className="mt-5 border-t border-slate-200 pt-3">
          <h3 className="text-xs font-semibold text-slate-600">היסטוריית מחירים ({history.length})</h3>
          <ul className="mt-2 space-y-1">
            {history.map((e) => {
              const del = canDeleteEntry(entries, e.id);
              const isActive = e.id === current?.id;
              return (
                <li key={e.id}
                  className={`flex items-center justify-between gap-2 rounded px-2 py-1 text-sm ${
                    isActive ? "bg-emerald-50 text-emerald-900" : "text-slate-600"}`}>
                  <span className="tnum">
                    {e.amount == null ? "— ללא סכום" : fmtILSExact(e.amount)}
                    <span className="mr-2 text-xs opacity-70">
                      {e.effectiveFrom ? `מ-${fmtDate(e.effectiveFrom)}` : "מאז ומעולם"}
                    </span>
                    {isActive && <span className="mr-2 text-[11px] font-medium">תקף היום</span>}
                    {e.effectiveFrom > asOf && (
                      <span className="mr-2 text-[11px] font-medium text-amber-700">עתידי</span>
                    )}
                  </span>
                  <button
                    disabled={!del.ok}
                    title={del.reason || "מחיקת שורה"}
                    onClick={() => onDelete(collection, e.id)}
                    className="text-xs text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-slate-300 disabled:no-underline">
                    מחיקה
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
