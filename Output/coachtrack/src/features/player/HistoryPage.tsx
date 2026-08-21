/**
 * "היסטוריה" — החיווט.
 *
 * אותם שני מאזינים של מסך "השבוע שלי" (מחזורי הקבוצה + הדיווחים של השחקן),
 * בלי שאילתה נוספת: כל ההיסטוריה נגזרת בלקוח מ-`buildWeekSummaries`. שאילתת
 * `entries` עם טווח תאריכים הייתה דורשת אינדקס מורכב (`playerUid` + `date`),
 * ופריסת אינדקסים חסומה לסוכן — ובעונה שלמה מדובר במאות מסמכים.
 *
 * המסך **אינו קורא תוכניות** בשביל היעדים. הוא קורא מחזורים, כי `itemsSnapshot`
 * הוא היעד שהיה בתוקף באותו שבוע. תוכנית שהשתנתה מאז לא משנה כאן דבר.
 */

import { useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { useCoachTeams } from '../../hooks/useCoachTeams';
import { usePlayerEntries } from '../../hooks/usePlayerEntries';
import { useTeamPlanning } from '../../hooks/useTeamPlanning';
import type { LoadStatus } from '../../hooks/loadStatus';
import { getWeekKey, nowInstant } from '../../lib/dates';
import { buildWeekSummaries, currentStreak, exerciseTrends } from '../../lib/entries';
import { t } from '../../i18n/he';
import { HistoryView } from './HistoryView';

const DEFAULT_STREAK_THRESHOLD = 80;

function combineStatus(...statuses: LoadStatus[]): LoadStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('loading')) return 'loading';
  return 'ready';
}

export function HistoryPage() {
  const { profile } = useAuth();
  const orgId = profile?.orgId;
  const playerUid = profile?.uid;
  const teamId = profile?.teamIds?.[0];

  const [now] = useState(() => nowInstant());

  const { status: teamsStatus, teams } = useCoachTeams(orgId, undefined);
  const { status: planningStatus, cycles } = useTeamPlanning(teamId, now);
  const { status: entriesStatus, entries } = usePlayerEntries(playerUid);

  const team = useMemo(() => teams.find((item) => item.id === teamId) ?? null, [teams, teamId]);
  const threshold = team?.settings?.streakThreshold ?? DEFAULT_STREAK_THRESHOLD;

  const summaries = useMemo(
    () => buildWeekSummaries(cycles, entries, { threshold }),
    [cycles, entries, threshold],
  );

  const currentWeekKey = getWeekKey(now);
  const streak = useMemo(
    () => currentStreak(summaries, currentWeekKey),
    [summaries, currentWeekKey],
  );
  const trends = useMemo(() => exerciseTrends(summaries), [summaries]);

  return (
    <AppShell title={t('player.history.title')}>
      <HistoryView
        status={combineStatus(teamsStatus, planningStatus, entriesStatus)}
        hasTeam={Boolean(teamId)}
        summaries={summaries}
        currentWeekKey={currentWeekKey}
        streak={streak}
        threshold={threshold}
        trends={trends}
      />
    </AppShell>
  );
}
