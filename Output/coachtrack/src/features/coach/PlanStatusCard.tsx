/**
 * "מה רץ עכשיו" — הכרטיס שהדשבורד חייב להציג לפי PRD §7.4:
 * *"הדשבורד מציג תמיד 'תוכנית פעילה מאז [תאריך]' כדי שיהיה ברור מה רץ."*
 *
 * הכרטיס מבחין בין שלושה מצבים שקל לבלבל ביניהם:
 * - **אין תוכנית פעילה** — השחקן רואה "אין תוכנית לשבוע זה", ולא 0%.
 * - **יש תוכנית, המחזור נפתח** — הדיווחים של השבוע נספרים אליו.
 * - **יש תוכנית, המחזור עוד לא נפתח** — היצירה עצלה, והיא תקרה מעצמה.
 *
 * התאריכים עוברים דרך `formatIsraeliDate` ולא דרך `toLocaleDateString`, כדי
 * שגם מכשיר שאינו בשעון ישראל יראה את אותו יום (כלל 6).
 */

import { Alert } from '../../components/ui/Alert';
import { formatIsraeliDate, getWeekBounds } from '../../lib/dates';
import { t } from '../../i18n/he';
import type { PlanCycleDoc, PlanDoc } from '../../types/types';

interface PlanStatusCardProps {
  plan: PlanDoc | null;
  cycle: PlanCycleDoc | null;
  cycleError: boolean;
  now: Date;
}

export function PlanStatusCard({ plan, cycle, cycleError, now }: PlanStatusCardProps) {
  const { weekStart, weekEnd } = getWeekBounds(now);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{t('coach.plan.status.title')}</h2>

      <p className="mt-2 text-sm text-slate-600">
        {t('coach.plan.status.week', {
          start: formatIsraeliDate(weekStart),
          end: formatIsraeliDate(weekEnd),
        })}
      </p>

      {plan ? (
        <>
          <p className="mt-1 text-sm font-medium text-slate-900">
            {t('coach.plan.status.activeSince', {
              date: formatIsraeliDate(plan.effectiveFrom),
            })}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {t('coach.plan.status.itemsCount', { count: plan.items.length })}
          </p>
          {plan.effectiveTo ? (
            <p className="mt-1 text-sm text-amber-800">
              {t('coach.plan.status.endsAt', { date: formatIsraeliDate(plan.effectiveTo) })}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-slate-600">
            {cycle ? t('coach.plan.status.cycleOpen') : t('coach.plan.status.cyclePending')}
          </p>
          <p className="mt-2 text-xs text-slate-500">{t('coach.plan.status.snapshotNote')}</p>
        </>
      ) : (
        <p className="mt-1 text-sm text-slate-600">{t('coach.plan.status.none')}</p>
      )}

      {cycleError ? (
        <div className="mt-3">
          <Alert tone="error">{t('coach.plan.status.cycleFailed')}</Alert>
        </div>
      ) : null}
    </section>
  );
}
