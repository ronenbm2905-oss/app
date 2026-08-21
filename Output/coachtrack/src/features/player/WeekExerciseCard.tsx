/**
 * כרטיס תרגיל במסך "השבוע שלי" — `400 / 500`, בר, אחוז, וכפתור דיווח.
 *
 * שתי נקודות שאסור לפספס:
 *
 * • **האחוז כאן אינו נחסם ב-100** (מלכודת 3 ב-TASKS.md). שחקן שעשה 900 מתוך
 *   300 רואה 300% — זה תגמול על מאמץ, וזו התצוגה היחידה שבה זה קורה. החסימה
 *   קיימת רק בטבעת הכללית, בתוך `overallPct`.
 *
 * • **היעד מגיע מ-`itemsSnapshot` של המחזור** ולא מהתוכנית. הכרטיס לא יודע
 *   מה זו תוכנית — הוא מקבל `WeekExerciseStat` מוכן מ-`lib/entries.ts`.
 *
 * ההנחיות נפתחות ונסגרות (`details`) ולא מוצגות תמיד: בטלפון של 375px, חמישה
 * כרטיסים עם פסקת הנחיות פתוחה הם מסך שאי אפשר לסרוק.
 */

import { Button } from '../../components/ui/Button';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { pctTone, roundPct } from '../../lib/calculations';
import type { WeekExerciseStat } from '../../lib/entries';
import { t } from '../../i18n/he';

interface WeekExerciseCardProps {
  stat: WeekExerciseStat;
  /** מושבת כשאין קבוצה או כשהמחזור לא נפתח — אין לאן לכתוב. */
  disabled: boolean;
  onReport: () => void;
}

export function WeekExerciseCard({ stat, disabled, onReport }: WeekExerciseCardProps) {
  const unitLabel = t(`units.${stat.unit}`);
  const pct = roundPct(stat.pct);
  const tone = pctTone(stat.pct);

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-slate-900">{stat.exerciseName}</h3>
          <p className="mt-0.5 text-sm text-slate-600">
            {t('player.myWeek.progress', {
              total: stat.total,
              target: stat.target,
              unit: unitLabel,
            })}
          </p>
        </div>

        <span className="shrink-0 text-lg font-bold text-slate-900">{pct}%</span>
      </div>

      <div className="mt-3">
        <ProgressBar
          pct={stat.pct}
          tone={tone}
          label={`${stat.exerciseName} — ${pct}%`}
        />
      </div>

      <p className="mt-2 text-sm text-slate-500">
        {stat.remaining > 0
          ? t('player.myWeek.remaining', { remaining: stat.remaining, unit: unitLabel })
          : t('player.myWeek.done')}
      </p>

      <p className="mt-0.5 text-xs text-slate-400">
        {stat.entryCount === 0
          ? t('player.myWeek.noEntriesYet')
          : stat.entryCount === 1
            ? t('player.myWeek.entryCountOne')
            : t('player.myWeek.entryCount', { count: stat.entryCount })}
      </p>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          {t('player.myWeek.showInstructions')}
        </summary>
        <p className="mt-2 whitespace-pre-line text-sm text-slate-600">
          {stat.notes.trim() || t('player.myWeek.noInstructions')}
        </p>
      </details>

      <div className="mt-3">
        <Button onClick={onReport} disabled={disabled}>
          {t('player.myWeek.reportAction')}
        </Button>
      </div>
    </li>
  );
}
