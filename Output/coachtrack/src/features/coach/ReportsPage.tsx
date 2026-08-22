/**
 * מסך הדוחות — החיווט (TASKS שלב 6).
 *
 * ## אפס מאזינים חדשים, אפס אינדקסים חדשים, אפס שינוי בכללים
 *
 * המסך משתמש **באותם ארבעה hooks** של הדשבורד: `useCoachTeams`,
 * `useOrgUsers`, `useTeamPlanning`, `useTeamEntries`. כל אחד מהם שאילתה עם
 * שוויון בודד (`orgId` / `teamId`) שכבר עברה QA חי בשלב 5. זו לא חסכנות —
 * שאילתה חדשה כאן הייתה דורשת `firebase deploy --only firestore:indexes`,
 * שחסום לסוכן, והמסך היה נופל ב-`PERMISSION_DENIED` אצל רונן בלי שאדע.
 *
 * ⚠️ שלוש נקודות שקל להחמיץ:
 *
 * 1. **`now` נלקח פעם אחת ונשמר ב-state**, כמו בכל שאר המסכים. הוא נכנס
 *    לתלויות של `useTeamPlanning` (שפותח את המחזור השבועי), ורגע שמתחדש
 *    בכל רינדור היה מייצר קריאת רשת בכל הקלדה בשדה תאריך.
 *
 * 2. **"שבוע שעבר" בהודעה מחושב מדוח נפרד** על השבוע שלפני הטווח, ולא
 *    מהפרש כלשהו בתוך הדוח הנוכחי. כך המספר הזה מגיע מאותו
 *    `buildTeamMatrix` כמו כל השאר, ולא מנוסחה שנייה.
 *
 * 3. **`previousPct` הוא `null` ולא 0 כשאין מחזור בשבוע הקודם.** הבחנה בין
 *    "היה 0%" ל"אין נתון" — בשבוע הראשון של העונה `(שבוע שעבר: 0%)` נראה
 *    כמו נפילה ולא כמו היעדר היסטוריה.
 */

import { useCallback, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { useCoachTeams } from '../../hooks/useCoachTeams';
import { useOrgUsers } from '../../hooks/useOrgUsers';
import { useTeamEntries } from '../../hooks/useTeamEntries';
import { useTeamPlanning } from '../../hooks/useTeamPlanning';
import type { LoadStatus } from '../../hooks/loadStatus';
import { copyText } from '../../lib/clipboard';
import { matrixPlayers } from '../../lib/dashboard';
import {
  addDaysToDayKey,
  getWeekBounds,
  nowInstant,
  toIsraeliDayKey,
  type DayKey,
} from '../../lib/dates';
import type { Feedback } from '../../lib/feedback';
import { onlyPlayers, playersOfTeam } from '../../lib/players';
import {
  buildPlayerWhatsAppText,
  buildTeamWhatsAppText,
  buildWeeklyReport,
  playerDetail,
  rangeForKind,
  type ReportRange,
  type ReportRangeKind,
} from '../../lib/report';
import { t } from '../../i18n/he';
import { ReportsView } from './ReportsView';

/** שגיאה גוברת על טעינה — אותה גזירה כמו בשאר המסכים. */
function combineStatus(...statuses: LoadStatus[]): LoadStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('loading')) return 'loading';
  return 'ready';
}

export function ReportsPage() {
  const { profile } = useAuth();
  const orgId = profile?.orgId;
  const coachUid = profile?.uid;

  const [now] = useState(() => nowInstant());
  const [requestedTeamId, setRequestedTeamId] = useState<string | null>(null);
  const [range, setRange] = useState<ReportRange>(() => rangeForKind('current', now));

  const [previewText, setPreviewText] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<Feedback | null>(null);

  const { status: teamsStatus, teams } = useCoachTeams(orgId, coachUid);
  const { status: usersStatus, users } = useOrgUsers(orgId);

  const teamId = useMemo(() => {
    if (requestedTeamId && teams.some((team) => team.id === requestedTeamId)) {
      return requestedTeamId;
    }
    return teams[0]?.id ?? null;
  }, [requestedTeamId, teams]);

  const { status: planningStatus, cycles } = useTeamPlanning(teamId ?? undefined, now);
  const { status: entriesStatus, entries } = useTeamEntries(teamId ?? undefined);

  const team = useMemo(() => teams.find((item) => item.id === teamId) ?? null, [teams, teamId]);

  const players = useMemo(
    () => matrixPlayers(playersOfTeam(onlyPlayers(users), teamId)),
    [users, teamId],
  );

  const report = useMemo(
    () => buildWeeklyReport({ players, cycles, entries, range }),
    [players, cycles, entries, range],
  );

  /**
   * הדוח של השבוע שלפני הטווח — למספר בסוגריים בהודעה.
   * `null` כשלא היה מחזור באותו שבוע (ולכן אין נתון, לא 0%).
   */
  const previousPct = useMemo(() => {
    const previousStart = addDaysToDayKey(toIsraeliDayKey(report.weekStart), -7);
    const previous = buildWeeklyReport({
      players,
      cycles,
      entries,
      range: { kind: 'previous', from: previousStart, to: addDaysToDayKey(previousStart, 6) },
    });

    if (previous.plannedWeekCount === 0 || previous.playerCount === 0) return null;
    return previous.averagePct;
  }, [players, cycles, entries, report.weekStart]);

  /* ---------------- פעולות ---------------- */

  const runCopy = useCallback((text: string) => {
    // הטקסט נכנס לתיבה **לפני** ניסיון ההעתקה: גם אם ההעתקה תיכשל
    // (http, הרשאה שנדחתה), המאמן רואה את מה שנוצר ויכול לסמן ידנית.
    setPreviewText(text);
    setCopyFeedback(null);

    copyText(text)
      .then((copied) => {
        setCopyFeedback({
          tone: copied ? 'success' : 'error',
          text: copied ? t('coach.reports.copied') : t('coach.reports.copyFailed'),
        });
      })
      .catch((error: unknown) => {
        console.error('[CoachTrack] העתקה ללוח נכשלה', error);
        setCopyFeedback({ tone: 'error', text: t('coach.reports.copyFailed') });
      });
  }, []);

  const handleCopyTeam = useCallback(() => {
    runCopy(
      buildTeamWhatsAppText({
        report,
        teamName: team ? team.name : '',
        previousPct,
      }),
    );
  }, [report, team, previousPct, runCopy]);

  /**
   * ⚠️ **סקירת עדי נדרשת לפני שלב 7.** ההודעה הזו יוצאת להורה, כלומר מוציאה
   * נתוני קטין מהמערכת לערוץ חיצוני. הפיצ'ר בסקופ לפי PRD §7.3ה ולכן נבנה;
   * הסימון כאן הוא כדי שהוא לא ייצא לפיילוט לפני שהשער עבר.
   * מה שנכלל בטקסט עצמו מתועד ב-`buildPlayerWhatsAppText`.
   */
  const handleCopyPlayer = useCallback(
    (playerUid: string) => {
      const detail = playerDetail(report, playerUid);
      if (!detail) return;

      runCopy(
        buildPlayerWhatsAppText({
          detail,
          teamName: team ? team.name : '',
          weekStart: report.weekStart,
          weekEnd: report.weekEnd,
        }),
      );
    },
    [report, team, runCopy],
  );

  const handleSelectRangeKind = useCallback(
    (kind: ReportRangeKind) => {
      // `custom` פותח על השבוע הנוכחי כנקודת מוצא, ולא על טווח ריק.
      setRange(rangeForKind(kind, now));
      setPreviewText(null);
      setCopyFeedback(null);
    },
    [now],
  );

  const handleChangeFrom = useCallback((day: DayKey) => {
    if (!day) return;
    setRange((current) => ({ ...current, kind: 'custom', from: day }));
  }, []);

  const handleChangeTo = useCallback((day: DayKey) => {
    if (!day) return;
    setRange((current) => ({ ...current, kind: 'custom', to: day }));
  }, []);

  const status = combineStatus(teamsStatus, usersStatus, planningStatus, entriesStatus);

  return (
    <AppShell title={t('coach.reports.title')}>
      <ReportsView
        status={status}
        hasTeam={Boolean(teamId)}
        teams={teams}
        selectedTeamId={teamId}
        onSelectTeam={setRequestedTeamId}
        range={range}
        onSelectRangeKind={handleSelectRangeKind}
        onChangeFrom={handleChangeFrom}
        onChangeTo={handleChangeTo}
        maxDay={toIsraeliDayKey(getWeekBounds(now).weekEnd)}
        report={report}
        previousPct={previousPct}
        previewText={previewText}
        onPreviewChange={setPreviewText}
        copyFeedback={copyFeedback}
        onCopyTeam={handleCopyTeam}
        onCopyPlayer={handleCopyPlayer}
      />
    </AppShell>
  );
}
