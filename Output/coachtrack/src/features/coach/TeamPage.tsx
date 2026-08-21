/**
 * מסך ניהול הקבוצה — החיווט.
 *
 * כאן, ורק כאן, נפגשים ה-hooks של Firestore עם התצוגה (`TeamView`). ההפרדה
 * הזו היא מה שמאפשר לבדוק את המסך בטסט בלי ענן.
 *
 * ⚠️ יצירת שחקן עוברת דרך `createPlayerAccount` שמשתמש באינסטנס Firebase **משני**.
 * זו לא קפריזה: `createUserWithEmailAndPassword` על האינסטנס הראשי היה מחליף את
 * המשתמש המחובר, והמאמן היה מוצא את עצמו מחובר כשחקן שהרגע יצר (מלכודת 7).
 * אחרי היצירה מצב האימות של המאמן לא זז, ולכן אין כאן שום טיפול ב"התחברות מחדש".
 */

import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { useCoachTeams } from '../../hooks/useCoachTeams';
import { useOrgUsers } from '../../hooks/useOrgUsers';
import type { LoadStatus } from '../../hooks/loadStatus';
import { AppShell } from '../../components/AppShell';
import { createPlayerAccount, PlayerProfileWriteError } from '../../lib/adminClient';
import { setPlayerActive } from '../../lib/playerAdmin';
import { firebaseErrorCode } from '../../lib/auth';
import { normalizeUsername } from '../../lib/auth';
import type { NewPlayerFormValues } from '../../lib/players';
import type { Feedback } from '../../lib/feedback';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import type { UserDoc } from '../../types/types';
import { TeamView } from './TeamView';

/** קודי שגיאה שיש להם הודעה מדויקת. כל השאר — הודעת יצירה גנרית. */
const CREATE_ERROR_KEYS: Record<string, TranslationKey> = {
  'auth/email-already-in-use': 'auth.errors.usernameTaken',
  'auth/weak-password': 'auth.errors.weakPassword',
  'auth/network-request-failed': 'auth.errors.network',
  'permission-denied': 'errors.permission',
};

function createErrorText(error: unknown): string {
  // המקרה היחיד שדורש התערבות ידנית: חשבון קיים בלי פרופיל.
  if (error instanceof PlayerProfileWriteError) {
    return t('coach.team.errors.profileWriteFailed', { username: error.username });
  }

  const key = CREATE_ERROR_KEYS[firebaseErrorCode(error)];
  return key ? t(key) : t('coach.team.errors.createFailed');
}

/** שני מקורות, מצב אחד. שגיאה גוברת על טעינה — אין טעם להמשיך להסתובב. */
function combineStatus(...statuses: LoadStatus[]): LoadStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('loading')) return 'loading';
  return 'ready';
}

export function TeamPage() {
  const { profile } = useAuth();
  const orgId = profile?.orgId;

  const { status: teamsStatus, teams } = useCoachTeams(orgId, profile?.uid);
  const { status: usersStatus, users } = useOrgUsers(orgId);

  const [requestedTeamId, setRequestedTeamId] = useState<string | null>(null);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // הקבוצה הנבחרת נגזרת ולא נשמרת: בחירה שכבר לא קיימת ברשימה נופלת אחורה
  // לקבוצה הראשונה, במקום להשאיר מסך ריק שנראה כמו תקלה.
  const selectedTeamId = useMemo(() => {
    if (requestedTeamId && teams.some((team) => team.id === requestedTeamId)) {
      return requestedTeamId;
    }
    return teams[0]?.id ?? null;
  }, [requestedTeamId, teams]);

  const handleAddPlayer = useCallback(
    async (values: NewPlayerFormValues): Promise<boolean> => {
      if (!orgId || !selectedTeamId) return false;

      setFeedback(null);
      try {
        await createPlayerAccount({
          displayName: values.displayName.trim(),
          username: normalizeUsername(values.username),
          password: values.password,
          orgId,
          teamIds: [selectedTeamId],
        });

        setFeedback({
          tone: 'success',
          text: t('coach.team.add.success', { name: values.displayName.trim() }),
        });
        return true;
      } catch (error) {
        console.error('[CoachTrack] יצירת שחקן נכשלה', error);
        setFeedback({ tone: 'error', text: createErrorText(error) });
        return false;
      }
    },
    [orgId, selectedTeamId],
  );

  const handleSetActive = useCallback(
    async (player: UserDoc, active: boolean): Promise<boolean> => {
      setBusyUid(player.uid);
      setFeedback(null);
      try {
        await setPlayerActive(player.uid, active);
        return true;
      } catch (error) {
        console.error('[CoachTrack] עדכון שחקן נכשל', error);
        setFeedback({ tone: 'error', text: t('coach.team.errors.updateFailed') });
        return false;
      } finally {
        setBusyUid(null);
      }
    },
    [],
  );

  return (
    <AppShell title={t('coach.team.title')}>
      <TeamView
        status={combineStatus(teamsStatus, usersStatus)}
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setRequestedTeamId}
        users={users}
        onAddPlayer={handleAddPlayer}
        onSetActive={handleSetActive}
        busyUid={busyUid}
        feedback={feedback}
      />
    </AppShell>
  );
}
