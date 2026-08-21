/**
 * בר התקדמות לתרגיל.
 *
 * שתי נקודות שקובעות שהוא נכון ב-RTL ולא רק נראה נכון:
 *
 * • **המילוי לא מוזז בשום `left`/`right`.** הוא איבר flex ראשון בתוך מכל
 *   שכיוונו יורש מ-`dir="rtl"` של המסמך, ולכן הוא גדל מימין לשמאל מעצמו.
 *   `margin-left` קשיח היה שובר אותו (כלל 1 ב-CLAUDE.md).
 *
 * • **הרוחב נחסם ב-100% אבל האחוז המוצג אינו נחסם.** שחקן ב-130% רואה בר מלא
 *   וכיתוב 130% — החסימה היא ויזואלית בלבד, ולא נוגעת בחישוב (מלכודת 3).
 */

import type { PctTone } from '../../lib/calculations';

const FILL_CLASSES: Record<PctTone, string> = {
  low: 'bg-red-500',
  mid: 'bg-amber-500',
  high: 'bg-emerald-500',
};

interface ProgressBarProps {
  /** האחוז האמיתי, לא חסום. */
  pct: number;
  tone: PctTone;
  /** תיאור נגיש. בלעדיו הבר הוא קישוט ריק לקורא מסך. */
  label: string;
}

export function ProgressBar({ pct, tone, label }: ProgressBarProps) {
  const width = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(width)}
      aria-label={label}
      className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
    >
      <div className={`h-full rounded-full ${FILL_CLASSES[tone]}`} style={{ width: `${width}%` }} />
    </div>
  );
}
