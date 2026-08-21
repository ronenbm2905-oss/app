/**
 * "מה השחקן יראה" — תצוגה מקדימה של מסך השחקן (PRD §7.3ב).
 *
 * המונים כאן קבועים על 0 בכוונה: זו התוכנית כפי שהיא נראית **בתחילת שבוע**,
 * וזה בדיוק מה שהמאמן צריך לראות לפני שהוא מפרסם. הכרטיסים האמיתיים נבנים
 * בשלב 4 מתוך `itemsSnapshot` של המחזור — לא מהתוכנית (מלכודת 2).
 *
 * הקומפוננטה טהורה: מקבלת פריטים, לא נוגעת ב-Firestore ולא ב-`Date`.
 */

import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import type { PlanDraftItem } from '../../lib/plans';

interface PlanPreviewProps {
  items: PlanDraftItem[];
}

export function PlanPreview({ items }: PlanPreviewProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{t('coach.plan.preview.title')}</h2>

      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{t('coach.plan.preview.empty')}</p>
      ) : (
        <>
          <p className="mt-2 text-sm font-medium text-slate-700">
            {t('coach.plan.preview.overall')}
          </p>

          <ul className="mt-3 space-y-2">
            {items.map((item) => {
              const unitLabel = t(`units.${item.unit}` as TranslationKey);
              const target = item.target.trim() || '—';

              return (
                <li key={item.exerciseId} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-900">{item.exerciseName}</p>
                    <p className="text-sm text-slate-600">
                      {t('coach.plan.preview.progress', { target, unit: unitLabel })}
                    </p>
                  </div>

                  {/* בר התקדמות ריק — 0%. `aria-hidden` כי המספר עצמו כבר כתוב לידו. */}
                  <div aria-hidden="true" className="mt-2 h-2 rounded-full bg-slate-100">
                    <div className="h-2 w-0 rounded-full bg-slate-900" />
                  </div>

                  {item.notes.trim() ? (
                    <p className="mt-2 whitespace-pre-line text-xs text-slate-600">
                      {item.notes}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>

          <p className="mt-3 text-xs text-slate-500">{t('coach.plan.preview.note')}</p>
        </>
      )}
    </section>
  );
}
