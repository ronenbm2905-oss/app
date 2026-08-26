/**
 * מסך התוכנית — החיווט.
 *
 * כאן נפגשים ארבעה מקורות: הקבוצות של המאמן, ספריית התרגילים, התוכניות
 * והמחזורים של הקבוצה, והתבניות של הארגון. כל אחד מהם הוא `onSnapshot` עם
 * **שוויון בודד** בשאילתה — אפס אינדקסים מורכבים חדשים.
 *
 * ⚠️ `now` נלקח פעם אחת בטעינת המסך ונשמר ב-state.
 * לא קפריזה: הוא נכנס לרשימת התלויות של ה-hook שפותח את המחזור השבועי, ורגע
 * שמתחדש בכל רינדור היה מייצר קריאת רשת חדשה בכל הקלדה בשדה יעד. המשמעות
 * המעשית היחידה היא שמאמן שישאיר את הטאב פתוח ממוצאי שבת אל תוך יום ראשון
 * יצטרך לרענן כדי לראות את השבוע החדש.
 */

import { useCallback, useMemo, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { useCoachTeams } from '../../hooks/useCoachTeams';
import { useExerciseLibrary } from '../../hooks/useExerciseLibrary';
import { usePlanTemplates } from '../../hooks/usePlanTemplates';
import { useTeamPlanning } from '../../hooks/useTeamPlanning';
import type { LoadStatus } from '../../hooks/loadStatus';
import { nowInstant, formatIsraeliDate, getNextWeekBounds } from '../../lib/dates';
import {
  deletePlanTemplate,
  publishPlan,
  savePlanTemplate,
  stopPlan,
  switchPlanNextWeek,
  updatePlanCurrentWeek,
} from '../../lib/planAdmin';
import { firebaseErrorCode } from '../../lib/auth';
import type { Feedback } from '../../lib/feedback';
import { t } from '../../i18n/he';
import type { TranslationKey } from '../../i18n/he';
import type { PlanItem, PlanTemplateDoc } from '../../types/types';
import { PlanView } from './PlanView';
import type { PlanAction } from './PlanView';

/** שגיאה אחת מתורגמת, עם מקרה מיוחד ל"אין הרשאה" — הכי סביר בשלב הזה. */
function errorText(error: unknown, fallback: TranslationKey): string {
  if (firebaseErrorCode(error) === 'permission-denied') return t('errors.permission');
  return t(fallback);
}

/** שני מקורות, מצב אחד. שגיאה גוברת על טעינה. */
function combineStatus(...statuses: LoadStatus[]): LoadStatus {
  if (statuses.includes('error')) return 'error';
  if (statuses.includes('loading')) return 'loading';
  return 'ready';
}

export function PlanPage() {
  const { profile } = useAuth();
  const orgId = profile?.orgId;
  const coachUid = profile?.uid ?? '';

  const [now] = useState(() => nowInstant());

  const { status: teamsStatus, teams } = useCoachTeams(orgId, profile?.uid);
  // בורר התרגילים מקבל את הספרייה **של המאמן הזה**: תרגיל קטלוג שהוא ערך מגיע
  // הנה כגרסה הפרטית שלו, ולא כמקור. ראה hooks/useExerciseLibrary.ts.
  // `entries` ו-`mine` נדרשים כדי לתרגם מזהה קטלוג למזהה העותק הפרטי שהחליף
  // אותו, ולהפך. בלעדיהם תרגיל שנערך אחרי שכבר נכנס לתוכנית נראה לבורר כתרגיל
  // חדש — והמאמן יכול להוסיף אותו פעמיים.
  const {
    status: libraryStatus,
    exercises,
    entries: libraryEntries,
    mine: myExercises,
  } = useExerciseLibrary(orgId, profile?.uid);
  const { status: templatesStatus, templates } = usePlanTemplates(orgId);

  const [requestedTeamId, setRequestedTeamId] = useState<string | null>(null);
  const [busy, setBusy] = useState<PlanAction | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // אותה גזירה כמו במסך ניהול הקבוצה: בחירה שלא קיימת יותר נופלת לקבוצה הראשונה.
  const selectedTeamId = useMemo(() => {
    if (requestedTeamId && teams.some((team) => team.id === requestedTeamId)) {
      return requestedTeamId;
    }
    return teams[0]?.id ?? null;
  }, [requestedTeamId, teams]);

  const { status: planningStatus, activePlan, currentCycle, cycleError } = useTeamPlanning(
    selectedTeamId ?? undefined,
    now,
  );

  /** עוטף כתיבה: מסמן עסוק, מתרגם שגיאה, ומחזיר אם הצליח. */
  const run = useCallback(
    async (
      action: PlanAction,
      work: () => Promise<void>,
      success: string,
      failureKey: TranslationKey,
    ): Promise<boolean> => {
      setBusy(action);
      setFeedback(null);
      try {
        await work();
        setFeedback({ tone: 'success', text: success });
        return true;
      } catch (error) {
        console.error('[CoachTrack] פעולת תוכנית נכשלה', error);
        setFeedback({ tone: 'error', text: errorText(error, failureKey) });
        return false;
      } finally {
        setBusy(null);
      }
    },
    [],
  );

  const handlePublish = useCallback(
    (items: PlanItem[]) => {
      if (!selectedTeamId || !orgId) return Promise.resolve(false);
      return run(
        'publish',
        async () => {
          await publishPlan({ teamId: selectedTeamId, orgId, coachUid, items, now });
        },
        t('coach.plan.publish.success'),
        'coach.plan.errors.publishFailed',
      );
    },
    [run, selectedTeamId, orgId, coachUid, now],
  );

  const handleCurrentWeek = useCallback(
    (items: PlanItem[]) => {
      if (!activePlan) return Promise.resolve(false);
      return run(
        'currentWeek',
        async () => {
          await updatePlanCurrentWeek(activePlan, currentCycle, items);
        },
        t('coach.plan.update.currentWeekSuccess'),
        'coach.plan.errors.saveFailed',
      );
    },
    [run, activePlan, currentCycle],
  );

  const handleNextWeek = useCallback(
    (items: PlanItem[]) => {
      if (!activePlan) return Promise.resolve(false);
      const date = formatIsraeliDate(getNextWeekBounds(now).weekStart);
      return run(
        'nextWeek',
        async () => {
          await switchPlanNextWeek(activePlan, items, now);
        },
        t('coach.plan.update.nextWeekSuccess', { date }),
        'coach.plan.errors.saveFailed',
      );
    },
    [run, activePlan, now],
  );

  const handleStop = useCallback(() => {
    if (!activePlan) return Promise.resolve(false);
    return run(
      'stop',
      async () => {
        await stopPlan(activePlan, now);
      },
      t('coach.plan.stop.success'),
      'coach.plan.errors.stopFailed',
    );
  }, [run, activePlan, now]);

  const handleSaveTemplate = useCallback(
    (name: string, items: PlanItem[]) => {
      if (!orgId) return Promise.resolve(false);
      return run(
        'template',
        async () => {
          await savePlanTemplate(name, items, orgId, coachUid);
        },
        t('coach.plan.templates.saveSuccess', { name: name.trim() }),
        'coach.plan.errors.templateSaveFailed',
      );
    },
    [run, orgId, coachUid],
  );

  const handleDeleteTemplate = useCallback(
    (template: PlanTemplateDoc) => {
      if (!window.confirm(t('coach.plan.templates.deleteConfirm', { name: template.name }))) {
        return Promise.resolve(false);
      }
      return run(
        'template',
        async () => {
          await deletePlanTemplate(template.id);
        },
        t('coach.plan.templates.deleteSuccess'),
        'coach.plan.errors.templateDeleteFailed',
      );
    },
    [run],
  );

  const handleLoadTemplate = useCallback(
    (template: PlanTemplateDoc, droppedCount: number) => {
      setFeedback({
        tone: 'success',
        text:
          droppedCount > 0
            ? t('coach.plan.templates.loadDropped', {
                name: template.name,
                count: droppedCount,
              })
            : t('coach.plan.templates.loadSuccess', { name: template.name }),
      });
    },
    [],
  );

  return (
    <AppShell title={t('coach.plan.title')}>
      <PlanView
        status={combineStatus(teamsStatus, libraryStatus, selectedTeamId ? planningStatus : 'ready')}
        teams={teams}
        selectedTeamId={selectedTeamId}
        onSelectTeam={setRequestedTeamId}
        exercises={exercises}
        libraryEntries={libraryEntries}
        myExercises={myExercises}
        activePlan={activePlan}
        currentCycle={currentCycle}
        cycleError={cycleError}
        now={now}
        templatesStatus={templatesStatus}
        templates={templates}
        coachUid={coachUid}
        busy={busy}
        feedback={feedback}
        onPublish={handlePublish}
        onUpdateCurrentWeek={handleCurrentWeek}
        onUpdateNextWeek={handleNextWeek}
        onStop={handleStop}
        onSaveTemplate={handleSaveTemplate}
        onLoadTemplate={handleLoadTemplate}
        onDeleteTemplate={handleDeleteTemplate}
      />
    </AppShell>
  );
}
