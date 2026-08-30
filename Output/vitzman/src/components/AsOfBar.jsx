import { Button } from "./ui/Button.jsx";
import { fmtDate, todayISO, fmtRelative, daysBetween } from "../utils/dates.js";

/**
 * בורר ״נכון לתאריך״.
 *
 * המנועים קיבלו `asOf` מהיום הראשון — `activeAsOf` בוחר את המחיר התקף לתאריך,
 * ו-`portfolioTotals` נגזר ממנו. עד עכשיו התאריך תמיד היה ״היום״, ולכן
 * היסטוריית המחירים הייתה נראית רק בשורה בודדת. הבורר הזה הופך אותה לעדשה
 * על התיק כולו: **מה היו המספרים ב-1 ביוני**.
 *
 * הכרעת עיצוב: כשהתאריך אינו היום, המסך **חייב להיראות אחרת**. מספר עבר
 * שנקרא כמספר נוכחי הוא בדיוק סוג הטעות שהמערכת הזו נבנתה כדי למנוע.
 */
export default function AsOfBar({ asOf, onChange, isHistorical }) {
  const today = todayISO();
  const delta = daysBetween(today, asOf);

  return (
    <div className={`border-b ${isHistorical ? "border-amber-300 bg-amber-100" : "border-slate-200 bg-white"}`}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2">
        <label className="flex items-center gap-2 text-xs font-medium text-slate-600">
          נכון לתאריך
          <input
            type="date"
            value={asOf}
            onChange={(e) => onChange(e.target.value)}
            aria-label="נכון לתאריך"
            className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-sm tnum"
          />
        </label>

        {isHistorical ? (
          <>
            <span className="text-sm font-semibold text-amber-900">
              צפייה בתמונה של {fmtDate(asOf)} ({fmtRelative(delta)}) — קריאה בלבד
            </span>
            <Button className="ms-auto" onClick={() => onChange(today)}>חזרה להיום</Button>
          </>
        ) : (
          <span className="text-xs text-slate-400">
            שינוי התאריך מציג את התיק לפי המחירים שהיו תקפים אז
          </span>
        )}
      </div>
    </div>
  );
}
