/**
 * דשבורד המאמן (PRD §7.3א) — התצוגה בלבד.
 *
 * אין כאן Firestore, אין `Date.now()` ואין חישוב: המטריצה מגיעה מוכנה
 * (`buildTeamMatrix` ב-`lib/dashboard.ts`), הרגע הנוכחי מוזרק, והמיון הוא
 * callback. זה מה שמאפשר לרנדר 15 שחקנים × 5 תרגילים בטסט בלי דפדפן.
 *
 * ## מה המסך אומר בכל מצב, ולמה זה לא אותו דבר
 *
 * • **אין קבוצה** → הודעה, בלי טבלה ריקה.
 * • **אין שחקנים פעילים** → הפניה למסך הקבוצה. טבלה עם שורת סיכום בלבד היא
 *   דיווח על כלום.
 * • **אין תוכנית לשבוע** → "אין מול מה למדוד" והפניה למסך התוכנית. זה **לא**
 *   0%: 0% אומר שהשחקנים לא עשו, ואין תוכנית אומר שלא ביקשו מהם (PRD §8.4).
 *   אותה הבחנה בדיוק שנעשתה במסך השחקן.
 * • **יש תוכנית** → שלושת ה-KPI ואז המטריצה.
 *
 * ה-KPI מוצג רק כשיש תוכנית, מאותה סיבה: "ממוצע קבוצתי 0%" בשבוע בלי יעדים
 * הוא מספר שקרי.
 */

import { Link } from 'react-router-dom';
import { Alert } from '../../components/ui/Alert';
import { SelectField } from '../../components/ui/Select';
import { roundPct } from '../../lib/calculations';
import { formatIsraeliDate } from '../../lib/dates';
import type { MatrixSort, MatrixSortKey, TeamMatrix as TeamMatrixData } from '../../lib/dashboard';
import type { LoadStatus } from '../../hooks/loadStatus';
import { ROUTES } from '../../lib/routing';
import { t } from '../../i18n/he';
import type { TeamDoc } from '../../types/types';
import { TeamMatrix } from './TeamMatrix';

export interface CoachDashboardViewProps {
  status: LoadStatus;
  hasTeam: boolean;
  teams: TeamDoc[];
  selectedTeamId: string | null;
  onSelectTeam: (teamId: string) => void;
  /** גבולות השבוע הנוכחי, לכותרת. */
  weekStart: Date;
  weekEnd: Date;
  daysLeft: number;
  /** האם נפתח מחזור לשבוע הזה. */
  hasPlan: boolean;
  /** פתיחת המחזור נכשלה — להבדיל מטעינה שנכשלה. */
  cycleError: boolean;
  matrix: TeamMatrixData;
  sort: MatrixSort;
  onSort: (key: MatrixSortKey) => void;
  onOpenPlayer: (playerUid: string) => void;
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

export function CoachDashboardView({
  status,
  hasTeam,
  teams,
  selectedTeamId,
  onSelectTeam,
  weekStart,
  weekEnd,
  daysLeft,
  hasPlan,
  cycleError,
  matrix,
  sort,
  onSort,
  onOpenPlayer,
}: CoachDashboardViewProps) {
  if (!hasTeam) {
    return <Alert tone="info">{t('coach.dashboard.noTeam')}</Alert>;
  }

  if (status === 'loading') {
    return <p className="text-sm text-slate-500">{t('coach.dashboard.loading')}</p>;
  }

  if (status === 'error') {
    return <Alert tone="error">{t('coach.dashboard.loadError')}</Alert>;
  }

  const selectedTeam = teams.find((team) => team.id === selectedTeamId) ?? null;
  const { kpi } = matrix;

  return (
    <div className="space-y-4">
      {/* בורר קבוצה רק כשיש יותר מאחת. ב-MVP יש קבוצה אחת, והבורר מיותר. */}
      {teams.length > 1 ? (
        <SelectField
          id="dashboard-team-select"
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

      <header className="rounded-2xl border border-slate-200 bg-white p-4">
        {selectedTeam ? (
          <p className="text-sm font-medium text-slate-700">{selectedTeam.name}</p>
        ) : null}
        <p className="mt-0.5 text-sm text-slate-500">
          {t('coach.dashboard.weekRange', {
            start: formatIsraeliDate(weekStart),
            end: formatIsraeliDate(weekEnd),
          })}
        </p>
        <p className="mt-0.5 text-sm text-slate-500">
          {daysLeft > 1
            ? t('coach.dashboard.daysLeft', { count: daysLeft })
            : t('coach.dashboard.lastDay')}
        </p>
      </header>

      {cycleError ? <Alert tone="error">{t('coach.dashboard.cycleFailed')}</Alert> : null}

      {kpi.playerCount === 0 ? (
        <div className="space-y-2">
          <Alert tone="info">{t('coach.dashboard.noPlayers')}</Alert>
          <p>
            <Link
              to={ROUTES.coachTeam}
              className="text-sm font-medium text-slate-700 underline underline-offset-4"
            >
              {t('coach.dashboard.noPlayersLink')}
            </Link>
          </p>
        </div>
      ) : !hasPlan ? (
        <div className="space-y-2">
          <Alert tone="info">{t('coach.dashboard.noPlan')}</Alert>
          <p>
            <Link
              to={ROUTES.coachPlan}
              className="text-sm font-medium text-slate-700 underline underline-offset-4"
            >
              {t('coach.dashboard.noPlanLink')}
            </Link>
          </p>
        </div>
      ) : (
        <>
          <section className="grid grid-cols-3 gap-2">
            <KpiCard
              label={t('coach.dashboard.kpi.average')}
              value={`${roundPct(kpi.averagePct)}%`}
              hint={t('coach.dashboard.kpi.averageHint')}
            />
            <KpiCard
              label={t('coach.dashboard.kpi.reported')}
              value={t('coach.dashboard.kpi.reportedValue', {
                count: kpi.reportedCount,
                total: kpi.playerCount,
              })}
              hint={t('coach.dashboard.kpi.reportedHint')}
            />
            <KpiCard
              label={t('coach.dashboard.kpi.zero')}
              value={String(kpi.zeroCount)}
              hint={t('coach.dashboard.kpi.zeroHint')}
            />
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold text-slate-900">
              {t('coach.dashboard.matrix.title')}
            </h2>
            <p className="text-xs text-slate-500">{t('coach.dashboard.matrix.hint')}</p>

            <TeamMatrix
              columns={matrix.columns}
              rows={matrix.rows}
              teamAverage={kpi.averagePct}
              sort={sort}
              onSort={onSort}
              onOpenPlayer={onOpenPlayer}
            />

            <p className="text-[11px] text-slate-400">{t('coach.dashboard.matrix.capNote')}</p>
          </section>
        </>
      )}
    </div>
  );
}
