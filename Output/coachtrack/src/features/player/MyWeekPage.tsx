/**
 * "השבוע שלי" — החיווט.
 *
 * שלושה מקורות, וכל אחד מהם `onSnapshot` עם **שוויון בודד** בשאילתה:
 * הקבוצות של הארגון (`orgId`), התוכניות והמחזורים של הקבוצה (`teamId`),
 * והדיווחים של השחקן (`playerUid`). אפס אינדקסים מורכבים חדשים.
 *
 * ⚠️ **`now` נלקח פעם אחת ונשמר ב-state**, בדיוק כמו במסך התוכנית: הוא נכנס
 * לרשימת התלויות של ה-hook שפותח את המחזור השבועי, ורגע שמתחדש בכל רינדור היה
 * מייצר קריאת רשת בכל הקלדה. המשמעות: שחקן שישאיר את הטאב פתוח ממוצאי שבת אל
 * תוך יום ראשון יראה את השבוע החדש רק אחרי רענון.
 *
 * ⚠️ **המחזור השבועי נפתח גם על ידי השחקן** (`useTeamPlanning`), וזה מכוון:
 * היצירה עצלה, ובבוקר יום ראשון סביר שהשחקן ייכנס לפני המאמן. `firestore.rules`
 * מתירים את זה בתנאי אחד — ש-`itemsSnapshot` יהיה זהה לתוכנית הפעילה.
 *
 * ⚠️ **`cycleId` של הדיווח נגזר מתאריך הביצוע ולא מהשבוע הנוכחי.** דיווח
 * רטרואקטיבי על שבוע שעבר מקבל את המחזור של אותו שבוע, ואם לא היה מחזור —
 * `null`. השיוך שממנו מחושבים האחוזים הוא ממילא `entry.date`; `cycleId` הוא
 * נוחות, ואיש אינו מאמת אותו ב-rules (todo פתוח ב-`rules-tests`).
 */

import { useCallback, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { useCoachTeams } from '../../hooks/useCoachTeams';
import { usePlayerEntries } from '../../hooks/usePlayerEntries';
import { useTeamPlanning } from '../../hooks/useTeamPlanning';
import type { LoadStatus } from '../../hooks/loadStatus';
import { firebaseErrorCode } from '../../lib/auth';
import { getWeekKey, nowInstant } from '../../lib/dates';
import {
  cycleIdForEntryDay,
  entriesForWeek,
  parseAmount,
  summarizeWeek,
  visibleEntries,
  type EntryDraft,
} from '../../lib/entries';
import { createEntry, softDeleteEntry, updateEntry } from '../../lib/entryAdmin';
import type { Feedback } from '../../lib/feedback';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import type { EntryDoc } from '../../types/types';
import { MyWeekView } from './MyWeekView';

/** ברירת מחדל כשהקבוצה עוד לא נטענה. זהה לערך ב-`teams.settings`. */
const DEFAULT_STREAK_THRESHOLD = 80;

function errorText(error: unknown, fallback: TranslationKey): string {
  if (firebaseErrorCode(error) === 'permission-denied') return t('errors.permission');
  return t(fallback);
}

/** שגיאה גוברת על טעינה — אותה גזירה כמו במסכי המאמן. */
function combineStatus(...statuses: LoadStatus[]): LoadStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('loading')) return 'loading';
  return 'ready';
}

export function MyWeekPage() {
  const { profile } = useAuth();
  const orgId = profile?.orgId;
  const playerUid = profile?.uid;
  // ה-MVP הוא קבוצה אחת לשחקן. הרשימה קיימת בסכמה, והמסך לוקח את הראשונה.
  const teamId = profile?.teamIds?.[0];

  const [now] = useState(() => nowInstant());
  const [reportBusy, setReportBusy] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [busyEntryId, setBusyEntryId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const { status: teamsStatus, teams } = useCoachTeams(orgId, undefined);
  const { status: planningStatus, cycles, currentCycle, cycleError } = useTeamPlanning(teamId, now);
  const { status: entriesStatus, entries } = usePlayerEntries(playerUid);

  const team = useMemo(() => teams.find((item) => item.id === teamId) ?? null, [teams, teamId]);
  const threshold = team?.settings?.streakThreshold ?? DEFAULT_STREAK_THRESHOLD;

  const weekEntries = useMemo(
    () => entriesForWeek(visibleEntries(entries), now),
    [entries, now],
  );

  // הסיכום נבנה מ-`itemsSnapshot` של המחזור — לעולם לא מ-`plan.items` (מלכודת 2).
  const summary = useMemo(
    () =>
      summarizeWeek(
        getWeekKey(now),
        currentCycle ? currentCycle.itemsSnapshot : null,
        weekEntries,
        threshold,
        currentCycle ? currentCycle.id : null,
      ),
    [now, currentCycle, weekEntries, threshold],
  );

  const handleCreate = useCallback(
    async (exerciseId: string, draft: EntryDraft): Promise<boolean> => {
      const amount = parseAmount(draft.amount);
      if (!teamId || !orgId || !playerUid || amount === null) {
        setReportError(t('player.report.errors.noTeam'));
        return false;
      }

      setReportBusy(true);
      setReportError(null);
      setFeedback(null);

      try {
        await createEntry({
          playerUid,
          teamId,
          orgId,
          exerciseId,
          amount,
          dayKey: draft.dayKey,
          note: draft.note.trim(),
          cycleId: cycleIdForEntryDay(cycles, draft.dayKey),
          createdBy: playerUid,
        });

        const stat = summary.items.find((item) => item.exerciseId === exerciseId);
        setFeedback({
          tone: 'success',
          text: t('player.report.success', {
            amount,
            unit: stat ? t(`units.${stat.unit}`) : '',
            exercise: stat ? stat.exerciseName : '',
          }),
        });
        return true;
      } catch (error) {
        console.error('[CoachTrack] שמירת הדיווח נכשלה', error);
        setReportError(errorText(error, 'player.report.errors.saveFailed'));
        return false;
      } finally {
        setReportBusy(false);
      }
    },
    [teamId, orgId, playerUid, cycles, summary],
  );

  const handleUpdate = useCallback(
    async (entry: EntryDoc, draft: EntryDraft): Promise<boolean> => {
      const amount = parseAmount(draft.amount);
      if (amount === null) return false;

      setReportBusy(true);
      setReportError(null);
      setFeedback(null);

      try {
        await updateEntry(entry.id, {
          amount,
          dayKey: draft.dayKey,
          note: draft.note.trim(),
          // התאריך עשוי לעבור שבוע — המחזור נגזר מחדש ולא נשאר על הישן.
          cycleId: cycleIdForEntryDay(cycles, draft.dayKey),
        });

        setFeedback({ tone: 'success', text: t('player.report.updateSuccess') });
        return true;
      } catch (error) {
        console.error('[CoachTrack] עדכון הדיווח נכשל', error);
        setReportError(errorText(error, 'player.report.errors.updateFailed'));
        return false;
      } finally {
        setReportBusy(false);
      }
    },
    [cycles],
  );

  const handleDelete = useCallback((entry: EntryDoc) => {
    if (!window.confirm(t('player.log.deleteConfirm'))) return;

    setBusyEntryId(entry.id);
    setFeedback(null);

    softDeleteEntry(entry)
      .then(() => {
        setFeedback({ tone: 'success', text: t('player.log.deleteSuccess') });
      })
      .catch((error: unknown) => {
        console.error('[CoachTrack] מחיקת הדיווח נכשלה', error);
        setFeedback({
          tone: 'error',
          text: errorText(error, 'player.report.errors.deleteFailed'),
        });
      })
      .finally(() => setBusyEntryId(null));
  }, []);

  return (
    <AppShell title={t('player.myWeek.title')}>
      <MyWeekView
        status={combineStatus(teamsStatus, planningStatus, entriesStatus)}
        teamName={team ? team.name : null}
        hasTeam={Boolean(teamId)}
        now={now}
        summary={summary}
        weekEntries={weekEntries}
        cycleError={cycleError}
        reportBusy={reportBusy}
        reportError={reportError}
        busyEntryId={busyEntryId}
        feedback={feedback}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onDelete={handleDelete}
      />
    </AppShell>
  );
}
