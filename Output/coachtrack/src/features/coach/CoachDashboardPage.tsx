/**
 * דשבורד המאמן וכרטיס השחקן — החיווט (TASKS שלב 5).
 *
 * ארבעה מאזינים, וכל אחד מהם **שוויון בודד** בשאילתה: הקבוצות של הארגון
 * (`orgId`), משתמשי הארגון (`orgId`), התוכניות והמחזורים של הקבוצה (`teamId`),
 * ודיווחי הקבוצה (`teamId`). אפס אינדקסים מורכבים חדשים, ולכן אין כאן שום
 * צורך ב-`firebase deploy --only firestore:indexes` שחסום לסוכן ממילא.
 *
 * ⚠️ ארבעה דברים שקל להחמיץ:
 *
 * 1. **`now` נלקח פעם אחת ונשמר ב-state**, כמו במסך התוכנית ובמסך השחקן. הוא
 *    נכנס לתלויות של ה-hook שפותח את המחזור השבועי, ורגע שמתחדש בכל רינדור
 *    היה מייצר קריאת רשת בכל לחיצה על כותרת עמודה.
 *
 * 2. **המחזור השבועי נפתח גם מכאן** (`useTeamPlanning`). זו אותה יצירה עצלה
 *    של מסך השחקן — מי שנכנס ראשון ביום ראשון פותח את המחזור.
 *
 * 3. **הכרטיס הוא state ולא נתיב.** ראה `PlayerCard.tsx` להסבר; הראוטים נגזרים
 *    מ-`navItemsForRole`, ונתיב עם פרמטר היה מקור אמת שני.
 *
 * 4. **`useCoachNote` נקרא תמיד**, גם כשאין שחקן נבחר — hook מותנה הוא באג
 *    ב-React. הוא פשוט לא נרשם בלי `playerUid`, ומחזיר "טעינה".
 */

import { useCallback, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { useCoachNote } from '../../hooks/useCoachNote';
import { useCoachTeams } from '../../hooks/useCoachTeams';
import { useOrgUsers } from '../../hooks/useOrgUsers';
import { useTeamEntries } from '../../hooks/useTeamEntries';
import { useTeamPlanning } from '../../hooks/useTeamPlanning';
import type { LoadStatus } from '../../hooks/loadStatus';
import { firebaseErrorCode } from '../../lib/auth';
import { saveCoachNote } from '../../lib/coachNoteAdmin';
import {
  DEFAULT_MATRIX_SORT,
  buildTeamMatrix,
  entriesForPlayer,
  historicalPlanItems,
  matrixPlayers,
  sortMatrixRows,
  toggleSort,
  type MatrixSortKey,
} from '../../lib/dashboard';
import {
  daysLeftInWeek,
  getWeekBounds,
  getWeekKey,
  nowInstant,
  toIsraeliDayKey,
} from '../../lib/dates';
import {
  buildWeekSummaries,
  currentStreak,
  cycleIdForEntryDay,
  draftFromEntry,
  entriesForWeek,
  exerciseTrends,
  parseAmount,
  type EntryDraft,
} from '../../lib/entries';
import { softDeleteEntry, updateEntry } from '../../lib/entryAdmin';
import type { Feedback } from '../../lib/feedback';
import { onlyPlayers, playersOfTeam } from '../../lib/players';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import type { EntryDoc } from '../../types/types';
import { CoachDashboardView } from './CoachDashboardView';
import { CoachEntryDialog } from './CoachEntryDialog';
import { PlayerCard } from './PlayerCard';

/** ברירת מחדל כשהקבוצה עוד לא נטענה. זהה לערך ב-`teams.settings`. */
const DEFAULT_STREAK_THRESHOLD = 80;

function errorText(error: unknown, fallback: TranslationKey): string {
  if (firebaseErrorCode(error) === 'permission-denied') return t('errors.permission');
  return t(fallback);
}

/** שגיאה גוברת על טעינה — אותה גזירה כמו בשאר המסכים. */
function combineStatus(...statuses: LoadStatus[]): LoadStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('loading')) return 'loading';
  return 'ready';
}

export function CoachDashboardPage() {
  const { profile } = useAuth();
  const orgId = profile?.orgId;
  const coachUid = profile?.uid;

  const [now] = useState(() => nowInstant());
  const [requestedTeamId, setRequestedTeamId] = useState<string | null>(null);
  const [selectedPlayerUid, setSelectedPlayerUid] = useState<string | null>(null);
  const [sort, setSort] = useState(DEFAULT_MATRIX_SORT);

  const [editing, setEditing] = useState<EntryDoc | null>(null);
  const [entryBusy, setEntryBusy] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [noteBusy, setNoteBusy] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [noteSaved, setNoteSaved] = useState(false);

  const { status: teamsStatus, teams } = useCoachTeams(orgId, coachUid);
  const { status: usersStatus, users } = useOrgUsers(orgId);

  // הקבוצה הנבחרת נגזרת ולא נשמרת — כמו במסך הקבוצה.
  const teamId = useMemo(() => {
    if (requestedTeamId && teams.some((team) => team.id === requestedTeamId)) {
      return requestedTeamId;
    }
    return teams[0]?.id ?? null;
  }, [requestedTeamId, teams]);

  const {
    status: planningStatus,
    cycles,
    currentCycle,
    cycleError,
  } = useTeamPlanning(teamId ?? undefined, now);
  const { status: entriesStatus, entries } = useTeamEntries(teamId ?? undefined);
  const { status: noteStatus, text: noteText, updatedAt: noteUpdatedAt } = useCoachNote(
    teamId ?? undefined,
    selectedPlayerUid ?? undefined,
  );

  const team = useMemo(() => teams.find((item) => item.id === teamId) ?? null, [teams, teamId]);
  const threshold = team?.settings?.streakThreshold ?? DEFAULT_STREAK_THRESHOLD;

  const teamPlayers = useMemo(
    () => playersOfTeam(onlyPlayers(users), teamId),
    [users, teamId],
  );

  const weekEntries = useMemo(() => entriesForWeek(entries, now), [entries, now]);

  const matrix = useMemo(
    () =>
      buildTeamMatrix(
        matrixPlayers(teamPlayers),
        currentCycle ? currentCycle.itemsSnapshot : null,
        weekEntries,
      ),
    [teamPlayers, currentCycle, weekEntries],
  );

  const sortedRows = useMemo(() => sortMatrixRows(matrix.rows, sort), [matrix.rows, sort]);

  /* ---------------- כרטיס השחקן ---------------- */

  const selectedPlayer = useMemo(
    () => teamPlayers.find((player) => player.uid === selectedPlayerUid) ?? null,
    [teamPlayers, selectedPlayerUid],
  );

  const playerEntries = useMemo(
    () => (selectedPlayerUid ? entriesForPlayer(entries, selectedPlayerUid) : []),
    [entries, selectedPlayerUid],
  );

  const summaries = useMemo(
    () => buildWeekSummaries(cycles, playerEntries, { threshold }),
    [cycles, playerEntries, threshold],
  );

  const currentWeekKey = getWeekKey(now);
  const streak = useMemo(
    () => currentStreak(summaries, currentWeekKey),
    [summaries, currentWeekKey],
  );
  const trends = useMemo(() => exerciseTrends(summaries), [summaries]);
  const logItems = useMemo(() => historicalPlanItems(cycles), [cycles]);

  /* ---------------- פעולות ---------------- */

  const handleUpdateEntry = useCallback(
    async (entry: EntryDoc, draft: EntryDraft): Promise<boolean> => {
      const amount = parseAmount(draft.amount);
      if (amount === null) return false;

      setEntryBusy(true);
      setEntryError(null);
      setFeedback(null);

      try {
        await updateEntry(entry.id, {
          amount,
          dayKey: draft.dayKey,
          note: draft.note.trim(),
          // התאריך עשוי לעבור שבוע — המחזור נגזר מחדש ולא נשאר על הישן.
          cycleId: cycleIdForEntryDay(cycles, draft.dayKey),
        });

        setFeedback({ tone: 'success', text: t('coach.player.log.updateSuccess') });
        return true;
      } catch (error) {
        console.error('[CoachTrack] עדכון הדיווח נכשל', error);
        setEntryError(errorText(error, 'coach.player.errors.updateFailed'));
        return false;
      } finally {
        setEntryBusy(false);
      }
    },
    [cycles],
  );

  const handleDeleteEntry = useCallback((entry: EntryDoc) => {
    if (!window.confirm(t('coach.player.log.deleteConfirm'))) return;

    setBusyEntryId(entry.id);
    setFeedback(null);

    softDeleteEntry(entry)
      .then(() => {
        setFeedback({ tone: 'success', text: t('coach.player.log.deleteSuccess') });
      })
      .catch((error: unknown) => {
        console.error('[CoachTrack] מחיקת הדיווח נכשלה', error);
        setFeedback({ tone: 'error', text: errorText(error, 'coach.player.errors.deleteFailed') });
      })
      .finally(() => setBusyEntryId(null));
  }, []);

  const handleSaveNote = useCallback(
    (text: string) => {
      if (!teamId || !selectedPlayerUid || !coachUid) return;

      setNoteBusy(true);
      setNoteError(null);
      setNoteSaved(false);

      saveCoachNote({ teamId, playerUid: selectedPlayerUid, text, coachUid })
        .then(() => setNoteSaved(true))
        .catch((error: unknown) => {
          console.error('[CoachTrack] שמירת הערת המאמן נכשלה', error);
          setNoteError(errorText(error, 'coach.player.note.errors.saveFailed'));
        })
        .finally(() => setNoteBusy(false));
    },
    [teamId, selectedPlayerUid, coachUid],
  );

  const openPlayer = useCallback((playerUid: string) => {
    setSelectedPlayerUid(playerUid);
    setFeedback(null);
    setNoteSaved(false);
    setNoteError(null);
  }, []);

  const status = combineStatus(teamsStatus, usersStatus, planningStatus, entriesStatus);
  const bounds = getWeekBounds(now);

  /* ---------------- תצוגה ---------------- */

  if (selectedPlayer) {
    const editItem = editing
      ? logItems.find((item) => item.exerciseId === editing.exerciseId) ?? null
      : null;

    return (
      <AppShell title={t('coach.player.title')}>
        <PlayerCard
          player={selectedPlayer}
          teamName={team ? team.name : null}
          summaries={summaries}
          currentWeekKey={currentWeekKey}
          streak={streak}
          threshold={threshold}
          trends={trends}
          entries={playerEntries}
          items={logItems}
          busyEntryId={busyEntryId}
          feedback={feedback}
          noteStatus={noteStatus}
          noteText={noteText}
          noteUpdatedAt={noteUpdatedAt}
          noteBusy={noteBusy}
          noteError={noteError}
          noteSaved={noteSaved}
          onSaveNote={handleSaveNote}
          onBack={() => setSelectedPlayerUid(null)}
          onEditEntry={(entry) => {
            setEntryError(null);
            setEditing(entry);
          }}
          onDeleteEntry={handleDeleteEntry}
        />

        {editing ? (
          <CoachEntryDialog
            playerName={selectedPlayer.displayName}
            exerciseName={editItem ? editItem.exerciseName : t('coach.player.log.offPlan')}
            unit={editItem ? editItem.unit : 'count'}
            originalDayKey={toIsraeliDayKey(editing.date)}
            initialDraft={draftFromEntry(editing)}
            now={now}
            busy={entryBusy}
            error={entryError}
            onSubmit={(draft) => handleUpdateEntry(editing, draft)}
            onClose={() => setEditing(null)}
          />
        ) : null}
      </AppShell>
    );
  }

  return (
    <AppShell title={t('coach.dashboard.title')}>
      <CoachDashboardView
        status={status}
        hasTeam={Boolean(teamId)}
        teams={teams}
        selectedTeamId={teamId}
        onSelectTeam={setRequestedTeamId}
        weekStart={bounds.weekStart}
        weekEnd={bounds.weekEnd}
        daysLeft={daysLeftInWeek(now)}
        hasPlan={Boolean(currentCycle)}
        cycleError={cycleError}
        matrix={{ ...matrix, rows: sortedRows }}
        sort={sort}
        onSort={(key: MatrixSortKey) => setSort((current) => toggleSort(current, key))}
        onOpenPlayer={openPlayer}
      />
    </AppShell>
  );
}
