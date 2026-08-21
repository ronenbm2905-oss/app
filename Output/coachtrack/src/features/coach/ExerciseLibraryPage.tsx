/**
 * ספריית התרגילים — החיווט.
 *
 * הרשימה מגיעה מ-useExerciseLibrary, שהוא **שני מאזינים** ולא אחד:
 * where('scope','==','global') ובנפרד where('orgId','==',orgId). ההסבר המלא
 * יושב בקובץ ה-hook; בשורה אחת: כלל הקריאה הוא "או" לוגי, ושאילתה אחת שתכסה
 * את שני הצדדים תיחסם כולה.
 *
 * כתיבה מותרת כאן רק לתרגילים של הארגון (scope: 'org'). הקטלוג הגלובלי הוא
 * admin-only ב-firestore.rules, והמסך לא מציע עליו פעולות עריכה.
 */

import { useCallback, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { useExerciseLibrary } from '../../hooks/useExerciseLibrary';
import {
  createOrgExercise,
  setExerciseActive,
  updateOrgExercise,
} from '../../lib/exerciseAdmin';
import type { ExerciseFormValues } from '../../lib/exercises';
import type { Feedback } from '../../lib/feedback';
import { t } from '../../i18n/he';
import type { ExerciseDoc } from '../../types/types';
import { ExerciseLibraryView } from './ExerciseLibraryView';

export function ExerciseLibraryPage() {
  const { profile } = useAuth();
  const orgId = profile?.orgId ?? '';

  const { status, exercises } = useExerciseLibrary(profile?.orgId);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const handleCreate = useCallback(
    async (values: ExerciseFormValues): Promise<boolean> => {
      if (!orgId) return false;

      setFeedback(null);
      try {
        await createOrgExercise(values, orgId);
        setFeedback({
          tone: 'success',
          text: t('coach.exercises.form.createSuccess', { name: values.name.trim() }),
        });
        return true;
      } catch (error) {
        console.error('[CoachTrack] יצירת תרגיל נכשלה', error);
        setFeedback({ tone: 'error', text: t('coach.exercises.errors.saveFailed') });
        return false;
      }
    },
    [orgId],
  );

  const handleUpdate = useCallback(
    async (exerciseId: string, values: ExerciseFormValues): Promise<boolean> => {
      setFeedback(null);
      try {
        await updateOrgExercise(exerciseId, values);
        setFeedback({
          tone: 'success',
          text: t('coach.exercises.form.editSuccess', { name: values.name.trim() }),
        });
        return true;
      } catch (error) {
        console.error('[CoachTrack] עדכון תרגיל נכשל', error);
        setFeedback({ tone: 'error', text: t('coach.exercises.errors.saveFailed') });
        return false;
      }
    },
    [],
  );

  const handleSetActive = useCallback(
    async (exercise: ExerciseDoc, active: boolean): Promise<boolean> => {
      setBusyId(exercise.id);
      setFeedback(null);
      try {
        await setExerciseActive(exercise.id, active);
        return true;
      } catch (error) {
        console.error('[CoachTrack] שינוי מצב תרגיל נכשל', error);
        setFeedback({ tone: 'error', text: t('coach.exercises.errors.saveFailed') });
        return false;
      } finally {
        setBusyId(null);
      }
    },
    [],
  );

  return (
    <AppShell title={t('coach.exercises.title')}>
      <ExerciseLibraryView
        status={status}
        exercises={exercises}
        orgId={orgId}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        onSetActive={handleSetActive}
        busyId={busyId}
        feedback={feedback}
      />
    </AppShell>
  );
}
