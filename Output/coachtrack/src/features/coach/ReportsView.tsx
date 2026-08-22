/**
 * מסך הסיכום השבועי (PRD §7.3ה) — התצוגה בלבד.
 *
 * אין כאן Firestore, אין `Date.now()` ואין `navigator.clipboard`: הדוח מגיע
 * מוכן מ-`lib/report.ts`, וההעתקה היא callback. זה מה שמאפשר לרנדר את המסך
 * בטסט בלי דפדפן ולבדוק שכל מצב אומר משהו.
 *
 * ## מה המסך אומר בכל מצב
 *
 * • **אין קבוצה** → הודעה, בלי טבלה ריקה.
 * • **טעינה / שגיאה** → הודעה מפורשת. אין מצב שבו המסך נשאר ריק.
 * • **אין תוכנית בטווח** → "אין מול מה למדוד" — **לא 0%** (PRD §8.4).
 * • **אין שחקנים** → הפניה למסך הקבוצה.
 * • **יש נתונים** → KPI, טבלת תרגילים, רשימת שחקנים, וכפתורי ההעתקה.
 *
 * ## תיבת התצוגה המקדימה אינה קישוט
 *
 * `navigator.clipboard` לא קיים ב-`http://` (כלומר בדיוק בבדיקה מהטלפון
 * ברשת הביתית — ראה `lib/clipboard.ts`). לכן הטקסט שנוצר מוצג תמיד ב-
 * `textarea` שאפשר לסמן ולהעתיק ידנית, וההעתקה האוטומטית היא הנוחות ולא
 * הפיצ'ר. הכפתור לעולם לא משאיר את המאמן בלי הטקסט.
 */

import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { SelectField } from '../../components/ui/Select';
import { TextField } from '../../components/ui/TextField';
import { pctTone, roundPct } from '../../lib/calculations';
import { formatIsraeliDate, type DayKey } from '../../lib/dates';
import type { Feedback } from '../../lib/feedback';
import type { LoadStatus } from '../../hooks/loadStatus';
import type { ReportRange, ReportRangeKind, WeeklyReport } from '../../lib/report';
import { ROUTES } from '../../lib/routing';
import { t } from '../../i18n/he';
import type { PctTone } from '../../lib/calculations';
import type { TeamDoc } from '../../types/types';

/** מיפוי דרגה→צבע — החלק היחיד כאן שהוא עיצוב. הספים ב-`lib/calculations.ts`. */
const PCT_TONES: Record<PctTone, string> = {
  low: 'text-red-700',
  mid: 'text-amber-700',
  high: 'text-emerald-700',
};

export interface ReportsViewProps {
  status: LoadStatus;
  hasTeam: boolean;
  teams: TeamDoc[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;

  range: ReportRange;
  onSelectRangeKind: (kind: ReportRangeKind) => void;
  onChangeFrom: (day: DayKey) => void;
  onChangeTo: (day: DayKey) => void;
  /** היום האחרון שאפשר לבחור. אין דוח על העתיד. */
  maxDay: DayKey;

  report: WeeklyReport;
  /** הממוצע של השבוע שלפני הטווח, או `null` כשאין נתון. */
  previousPct: number | null;

  /** הטקסט שנוצר בהעתקה האחרונה. `null` = עוד לא נוצר טקסט. */
  previewText: string | null;
  onPreviewChange: (text: string) => void;
  copyFeedback: Feedback | null;

  onCopyTeam: () => void;
  onCopyPlayer: (playerUid: string) => void;
}

function KpiCard({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-0.5 text-2xl font-bold text-slate-900">{value}</p>
      <p className="mt-0.5 text-[11px] leading-tight text-slate-400">{hint}</p>
    </div>
  );
}

export function ReportsView({
  status,
  hasTeam,
  teams,
  selectedTeamId,
  onSelectTeam,
  range,
  onSelectRangeKind,
  onChangeFrom,
  onChangeTo,
  maxDay,
  report,
  previousPct,
  previewText,
  onPreviewChange,
  copyFeedback,
  onCopyTeam,
  onCopyPlayer,
}: ReportsViewProps) {
  if (!hasTeam) {
    return <Alert tone="info">{t('coach.reports.noTeam')}</Alert>;
  }

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">{t('coach.reports.loading')}</p>;
  }

  if (status === 'error') {
    return <Alert tone="error">{t('coach.reports.loadError')}</Alert>;
  }

  const hasPlan = report.plannedWeekCount > 0;

  const rangeControls = (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      {teams.length > 1 ? (
        <SelectField
          id="reports-team-select"
          label={t('coach.dashboard.teamSelectLabel')}
          value={selectedTeamId ?? ''}
          onChange={(event) => onSelectTeam(event.target.value)}
        >
          {teams.map((team) => (
            <option key={team.id} value={team.id}>
              {team.name}
            </option>
          ))}
        </SelectField>
      ) : null}

      <SelectField
        id="reports-range-select"
        label={t('coach.reports.rangeLabel')}
        value={range.kind}
        onChange={(event) => onSelectRangeKind(event.target.value as ReportRangeKind)}
      >
        <option value="current">{t('coach.reports.rangeCurrent')}</option>
        <option value="previous">{t('coach.reports.rangePrevious')}</option>
        <option value="custom">{t('coach.reports.rangeCustom')}</option>
      </SelectField>

      {range.kind === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <TextField
            id="reports-from"
            type="date"
            label={t('coach.reports.from')}
            value={range.from}
            max={maxDay}
            onChange={(event) => onChangeFrom(event.target.value)}
          />
          <TextField
            id="reports-to"
            type="date"
            label={t('coach.reports.to')}
            value={range.to}
            max={maxDay}
            onChange={(event) => onChangeTo(event.target.value)}
          />
        </div>
      ) : null}

      {/* הטווח נצמד לשבועות שלמים — מוצג תמיד, כדי שלא תהיה הפתעה. */}
      <p className="text-xs text-slate-500">
        {t('coach.reports.snapNote', {
          start: formatIsraeliDate(report.weekStart),
          end: formatIsraeliDate(report.weekEnd),
        })}
        {report.weeks.length > 1
          ? ` ${t('coach.reports.weeksCount', { count: report.weeks.length })}`
          : ''}
      </p>
    </section>
  );

  const preview = previewText === null ? null : (
    <section className="space-y-2">
      {copyFeedback ? (
        <Alert tone={copyFeedback.tone === 'error' ? 'error' : 'success'}>
          {copyFeedback.text}
        </Alert>
      ) : null}

      <label
        htmlFor="reports-preview"
        className="block text-sm font-medium text-slate-700"
      >
        {t('coach.reports.previewLabel')}
      </label>
      <textarea
        id="reports-preview"
        value={previewText}
        onChange={(event) => onPreviewChange(event.target.value)}
        rows={10}
        className="block w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline focus:outline-2 focus:outline-slate-900"
      />
      <p className="text-xs text-slate-500">{t('coach.reports.previewHint')}</p>
    </section>
  );

  if (!hasPlan) {
    return (
      <div className="space-y-4">
        {rangeControls}
        <Alert tone="info">
          <span className="font-semibold">{t('coach.reports.noPlanTitle')}</span>{' '}
          {t('coach.reports.noPlanBody')}
        </Alert>
        <p>
          <Link
            to={ROUTES.coachPlan}
            className="text-sm font-medium text-slate-700 underline underline-offset-4"
          >
            {t('coach.dashboard.noPlanLink')}
          </Link>
        </p>
      </div>
    );
  }

  if (report.playerCount === 0) {
    return (
      <div className="space-y-4">
        {rangeControls}
        <Alert tone="info">{t('coach.reports.noPlayers')}</Alert>
        <p>
          <Link
            to={ROUTES.coachTeam}
            className="text-sm font-medium text-slate-700 underline underline-offset-4"
          >
            {t('coach.dashboard.noPlayersLink')}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {rangeControls}

      <section className="grid grid-cols-3 gap-2">
        <KpiCard
          label={t('coach.reports.kpiAverage')}
          value={`${roundPct(report.averagePct)}%`}
          hint={t('coach.reports.kpiAverageHint')}
        />
        <KpiCard
          label={t('coach.reports.kpiReported')}
          value={t('coach.reports.kpiReportedValue', {
            count: report.reportedCount,
            total: report.playerCount,
          })}
          hint={t('coach.reports.kpiReportedHint')}
        />
        <KpiCard
          label={t('coach.reports.kpiZero')}
          value={String(report.zeroCount)}
          hint={t('coach.reports.kpiZeroHint')}
        />
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-slate-900">{t('coach.reports.exercisesTitle')}</h2>
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {report.exercises.map((item) => (
            <li key={item.exerciseId} className="flex items-baseline justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{item.exerciseName}</p>
                <p className="text-xs text-slate-500">
                  {t('coach.reports.exerciseTotal')} {item.total} · {t('coach.reports.exerciseTarget')}{' '}
                  {item.target} {t(`units.${item.unit}`)}
                </p>
              </div>
              <p className={`text-lg font-bold ${PCT_TONES[pctTone(item.avgPct)]}`}>
                {roundPct(item.avgPct)}%
              </p>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold text-slate-900">{t('coach.reports.playersTitle')}</h2>
        <p className="text-xs text-slate-500">{t('coach.reports.playersHint')}</p>

        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {report.players.map((player) => (
            <li key={player.uid} className="flex items-center justify-between gap-3 p-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{player.displayName}</p>
                <p className="text-xs text-slate-500">
                  {player.weeksCounted === 0
                    ? t('coach.reports.playerNoData')
                    : report.weeks.length > 1
                      ? t('coach.reports.playerWeeks', { count: player.weeksCounted })
                      : ''}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <p className={`text-lg font-bold ${PCT_TONES[pctTone(player.pct)]}`}>
                  {roundPct(player.pct)}%
                </p>
                {/*
                  הטקסט הגלוי קצר, וה-aria-label נושא את המשמעות המלאה עם שם
                  השחקן. שלושה כפתורים עם אותה תווית אינם מובחנים בקורא מסך.

                  אין כאן מחלקות שמקטינות את הכפתור: `px-3` מול `px-4` של
                  `Button` הן שתי utilities באותה specificity, והמנצחת נקבעת
                  בסדר הגיליון ולא בסדר ה-className. גובה 44px הוא ממילא מה
                  שכלל 2 (מובייל-פירסט) דורש ממטרת מגע.
                */}
                <Button
                  variant="secondary"
                  fullWidth={false}
                  aria-label={t('coach.reports.copyPlayerFor', { name: player.displayName })}
                  onClick={() => onCopyPlayer(player.uid)}
                >
                  {t('coach.reports.copyPlayerShort')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <Button onClick={onCopyTeam}>{t('coach.reports.copyTeam')}</Button>

      {/* הממוצע של השבוע הקודם נכנס להודעה; כאן הוא מוצג כדי שיהיה אפשר לאמת. */}
      {previousPct === null ? null : (
        <p className="text-xs text-slate-500">
          {t('coach.reports.text.previous', { pct: roundPct(previousPct) })}
        </p>
      )}

      {preview}
    </div>
  );
}
