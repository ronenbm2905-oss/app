/**
 * גרף העמודות של האחוז השבועי — **משותף לשחקן ולמאמן**.
 *
 * הועבר לכאן בשלב 5: אותו גרף בדיוק מופיע במסך ההיסטוריה של השחקן (PRD §7.2ג)
 * ובכרטיס השחקן של המאמן (§7.3ג). זו לא חיסכון בשורות אלא החלטה — שני מסכים
 * שמציירים "התקדמות שבועית" בשתי דרכים שונות הם שתי אמיתות, והראשון שיתבלבל
 * הוא המאמן שמסתכל על המספר של הילד ליד הילד עצמו.
 *
 * ## למה זה לא Recharts
 *
 * מלכודת 4 ב-TASKS.md אומרת ש-Recharts לא יודע RTL, ושצירים ותוויות דורשים
 * הגדרה ידנית. כאן מדובר ב-12 מלבנים בלי צירים, בלי טולטיפ ובלי לג'נד —
 * ומכיוון שאין לי דפדפן, ספריית גרפים הייתה מוסיפה קומפוננטה שאי אפשר לרנדר
 * בטסט (`ResponsiveContainer` מחזיר ריק בלי מדידת DOM) ואי אפשר לאמת בעין.
 * מלבנים ב-CSS מופיעים ב-HTML של הטסט עם הגובה שלהם, ולכן הם **נבדקים**.
 *
 * ⚠️ שלב 4 השאיר כאן הערה ש-Recharts יחזור בגרף של המאמן בשלב 5. הוא לא חזר,
 * ומאותה סיבה עצמה: גם לכרטיס השחקן אין צירים אמיתיים, וגם אותו אי אפשר לאמת
 * בעין. Recharts נשאר בסטאק ובלתי מנוצל — החלטה לרונן, לא לסוכן.
 *
 * **RTL:** אין כאן שום `left`/`right`. המכל יורש `dir="rtl"` מהמסמך, ולכן
 * האיבר הראשון ברשימה יושב מימין — ומכיוון שהשבועות מגיעים מהחדש לישן,
 * העמודה הימנית היא השבוע האחרון, בדיוק כמו שקוראים עברית.
 */

import { pctTone, roundPct } from '../lib/calculations';
import { formatIsraeliDate } from '../lib/dates';
import type { WeekSummary } from '../lib/entries';
import { t } from '../i18n/he';

const BAR_CLASSES = {
  low: 'bg-red-500',
  mid: 'bg-amber-500',
  high: 'bg-emerald-500',
} as const;

/** כמה שבועות מוצגים. מעבר לזה העמודות צרות מדי במסך של 375px. */
const MAX_BARS = 12;

interface WeeklyBarsProps {
  /** שבועות מהחדש לישן. */
  summaries: readonly WeekSummary[];
}

export function WeeklyBars({ summaries }: WeeklyBarsProps) {
  const shown = summaries.slice(0, MAX_BARS);

  return (
    <ul className="flex h-32 items-end gap-1.5">
      {shown.map((summary) => {
        const pct = roundPct(summary.overall);
        // גובה מינימלי כדי ש-0% ושבוע בלי תוכנית עדיין יהיו נראים כעמודה.
        const height = summary.hasPlan ? Math.max(4, Math.min(100, pct)) : 4;
        const tone = summary.hasPlan ? BAR_CLASSES[pctTone(summary.overall)] : 'bg-slate-300';

        return (
          <li key={summary.weekKey} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={`w-full rounded-t ${tone}`}
              style={{ height: `${height}%` }}
              role="img"
              aria-label={
                summary.hasPlan
                  ? `${formatIsraeliDate(summary.weekStart)} — ${pct}%`
                  : `${formatIsraeliDate(summary.weekStart)} — ${t('player.history.noPlanWeek')}`
              }
            />
            <span className="mt-1 block text-center text-[10px] text-slate-400">
              {formatIsraeliDate(summary.weekStart).slice(0, 5)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
