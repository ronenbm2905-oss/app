/**
 * טבעת האחוז הכללי — הדבר הראשון שהשחקן רואה כשהוא פותח את האפליקציה.
 *
 * SVG ולא ספריית גרפים: זו קשת אחת. `stroke-dasharray` על מעגל, סיבוב של
 * ‎-90°‎ כדי שהקשת תתחיל למעלה, וזהו. ספריית גרפים כאן הייתה 40KB בשביל מעגל.
 *
 * ⚠️ הטבעת מציגה את **האחוז הכללי**, שכבר נחסם ב-100 בתוך `overallPct`
 * (מלכודת 3). היא לא חוסמת שוב ולא מבטלת חסימה — היא מציירת את מה שקיבלה.
 *
 * RTL: לא מוגדר כאן שום כיוון. מעגל הוא סימטרי, והמספר במרכזו הוא ספרות
 * וסימן אחוז — שניהם ניטרליים לכיוון.
 */

import type { PctTone } from '../../lib/calculations';

const STROKE_CLASSES: Record<PctTone, string> = {
  low: 'stroke-red-500',
  mid: 'stroke-amber-500',
  high: 'stroke-emerald-500',
};

interface ProgressRingProps {
  /** אחוז 0–100. ערך גדול יותר ייחתך ויוצג כטבעת מלאה. */
  pct: number;
  /** הכיתוב שמתחת למספר. */
  caption: string;
  /** תיאור נגיש מלא, למשל "השלמה כללית: 83%". */
  label: string;
  tone: PctTone;
}

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ pct, caption, label, tone }: ProgressRingProps) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  const filled = (safe / 100) * CIRCUMFERENCE;

  return (
    <div className="flex flex-col items-center" role="img" aria-label={label}>
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="12"
            className="stroke-slate-200"
          />
          <circle
            cx="60"
            cy="60"
            r={RADIUS}
            fill="none"
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={`${filled} ${CIRCUMFERENCE - filled}`}
            className={STROKE_CLASSES[tone]}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span aria-hidden="true" className="text-3xl font-bold text-slate-900">
            {Math.round(safe)}%
          </span>
        </div>
      </div>

      <p className="mt-2 text-sm font-medium text-slate-600">{caption}</p>
    </div>
  );
}
