/**
 * "היסטוריה" — התצוגה בלבד (PRD §7.2ג): רצף התמדה, גרף עמודות, רשימת שבועות
 * ופילוח לפי תרגיל.
 *
 * כל מה שמוצג כאן נבנה ב-`lib/entries.ts` מתוך **המחזורים** ומתוך הדיווחים —
 * כלומר כל שבוע מוצג מול היעדים שהיו בתוקף *בו*, ולא מול היעדים של היום
 * (מלכודת 2 ב-TASKS.md). זה ההבדל בין היסטוריה לבין שכתוב היסטוריה.
 *
 * שבוע בלי תוכנית מוצג כשבוע בלי אחוז — לא כ-0%. ההבדל אינו קוסמטי: שבוע
 * חופשה שנספר כ-0% היה מוריד את הממוצע ושובר את הרצף בלי שהשחקן עשה דבר.
 */

import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { ProgressBar } from '../../components/ui/ProgressBar';
import { pctTone, roundPct } from '../../lib/calculations';
import { formatIsraeliDate } from '../../lib/dates';
import type { ExerciseTrend, WeekSummary } from '../../lib/entries';
import type { LoadStatus } from '../../hooks/loadStatus';
import { ROUTES } from '../../lib/routing';
import { t } from '../../i18n/he';
import { WeeklyBars } from '../../components/WeeklyBars';

export interface HistoryViewProps {
  status: LoadStatus;
  hasTeam: boolean;
  /** שבועות מהחדש לישן. */
  summaries: WeekSummary[];
  /** מפתח-היום של השבוע הנוכחי — לסימון "השבוע הנוכחי". */
  currentWeekKey: string;
  streak: number;
  threshold: number;
  trends: ExerciseTrend[];
}

export function HistoryView({
  status,
  hasTeam,
  summaries,
  currentWeekKey,
  streak,
  threshold,
  trends,
}: HistoryViewProps) {
  if (!hasTeam) {
    return <Alert tone="info">{t('player.myWeek.noTeam')}</Alert>;
  }

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">{t('player.history.loading')}</p>;
  }

  if (status === 'error') {
    return <Alert tone="error">{t('player.history.loadError')}</Alert>;
  }

  if (summaries.length === 0) {
    return (
      <div className="space-y-3">
        <Alert tone="info">{t('player.history.empty')}</Alert>
        <BackLink />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* רצף התמדה */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">{t('player.history.streakTitle')}</h2>
        <p className="mt-1 text-2xl font-bold text-slate-900">
          {streak === 0
            ? t('player.history.streakNone')
            : streak === 1
              ? t('player.history.streakOne')
              : t('player.history.streakWeeks', { count: streak })}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {streak === 0
            ? t('player.history.streakOpenHint', { threshold })
            : t('player.history.streakHint', { threshold })}
        </p>
        <p className="mt-1 text-xs text-slate-400">{t('player.history.streakRunningWeek')}</p>
      </section>

      {/* גרף עמודות */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4">
        <h2 className="text-lg font-bold text-slate-900">{t('player.history.chartTitle')}</h2>
        <p className="mt-0.5 text-xs text-slate-500">{t('player.history.chartHint')}</p>
        <div className="mt-3">
          <WeeklyBars summaries={summaries} />
        </div>
      </section>

      {/* שבוע אחר שבוע */}
      <section>
        <h2 className="text-lg font-bold text-slate-900">{t('player.history.weeksTitle')}</h2>
        <ul className="mt-2 space-y-3">
          {summaries.map((summary) => (
            <li key={summary.weekKey} className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {t('player.myWeek.weekRange', {
                      start: formatIsraeliDate(summary.weekStart),
                      end: formatIsraeliDate(summary.weekEnd),
                    })}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {summary.entryCount === 1
                      ? t('player.history.weekEntriesOne')
                      : t('player.history.weekEntries', { count: summary.entryCount })}
                  </p>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1">
                  {summary.weekKey === currentWeekKey ? (
                    <Badge tone="accent">{t('player.history.currentWeek')}</Badge>
                  ) : null}
                  {summary.hasPlan ? (
                    <span className="text-lg font-bold text-slate-900">
                      {roundPct(summary.overall)}%
                    </span>
                  ) : (
                    <Badge tone="muted">{t('player.history.noPlanWeek')}</Badge>
                  )}
                </div>
              </div>

              {summary.hasPlan ? (
                <>
                  <div className="mt-3">
                    <ProgressBar
                      pct={summary.overall}
                      tone={pctTone(summary.overall)}
                      label={`${formatIsraeliDate(summary.weekStart)} — ${roundPct(summary.overall)}%`}
                    />
                  </div>

                  <ul className="mt-3 space-y-1">
                    {summary.items.map((item) => (
                      <li key={item.exerciseId} className="text-sm text-slate-600">
                        {t('player.history.weekExercise', {
                          name: item.exerciseName,
                          total: item.total,
                          target: item.target,
                          unit: t(`units.${item.unit}`),
                        })}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  {t('player.history.noPlanWeekHint')}
                </p>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* פילוח לפי תרגיל */}
      {trends.length > 0 ? (
        <section>
          <h2 className="text-lg font-bold text-slate-900">
            {t('player.history.breakdownTitle')}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">{t('player.history.breakdownHint')}</p>

          <ul className="mt-2 space-y-3">
            {trends.map((trend) => (
              <li
                key={trend.exerciseId}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-base font-semibold text-slate-900">
                      {trend.exerciseName}
                    </h3>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {t('player.history.breakdownTotals', {
                        total: trend.total,
                        target: trend.target,
                        unit: t(`units.${trend.unit}`),
                      })}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      {t('player.history.breakdownWeeks', { count: trend.weeks })}
                    </p>
                  </div>

                  <span className="shrink-0 text-lg font-bold text-slate-900">
                    {roundPct(trend.pct)}%
                  </span>
                </div>

                <div className="mt-3">
                  <ProgressBar
                    pct={trend.pct}
                    tone={pctTone(trend.pct)}
                    label={`${trend.exerciseName} — ${roundPct(trend.pct)}%`}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BackLink />
    </div>
  );
}

function BackLink() {
  return (
    <p className="text-center">
      <Link
        to={ROUTES.player}
        className="text-sm font-medium text-slate-700 underline underline-offset-4"
      >
        {t('player.history.backToWeek')}
      </Link>
    </p>
  );
}
