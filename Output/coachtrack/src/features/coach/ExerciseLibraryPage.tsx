/**
 * ספריית התרגילים — החיווט.
 *
 * הרשימה מגיעה מ-`useExerciseLibrary`, שהוא **שני מאזינים** ולא אחד:
 * `where('scope','==','global')` ובנפרד `where('coachUid','==',uid)`. ההסבר
 * המלא יושב בקובץ ה-hook; בשורה אחת: כלל הקריאה הוא "או" לוגי, ושאילתה אחת
 * שתכסה את שני הצדדים תיחסם כולה.
 *
 * ## שלוש הכתיבות, ומה מבדיל ביניהן
 *
 * | הכרטיס | הפעולה | מה נכתב |
 * |---|---|---|
 * | `mine` — תרגיל שהמאמן יצר | עריכה | `updateDoc` על המסמך שלו |
 * | `edited` — עותק פרטי קיים | עריכה | `updateDoc` על העותק |
 * | `catalog` — תרגיל קטלוג | עריכה | **מסמך חדש**: עותק פרטי עם `sourceExerciseId` |
 *
 * בשום מסלול לא נכתב למסמך הגלובלי. הוא נקרא בידי כל ארגון במערכת, ולכן עריכה
 * שלו הייתה מופיעה בספרייה של כל אגודה אחרת — הדגל החמור בסקירת עדי.
 * `firestore.rules` חוסמים את זה גם אם המסך יטעה.
 */

import { useCallback, useState } from 'react';
import { AppShell } from '../../components/AppShell';
import { useAuth } from '../../hooks/useAuth';
import { useExerciseLibrary } from '../../hooks/useExerciseLibrary';
import {
  createCoachExercise,
  revertExerciseOverride,
  saveExerciseOverride,
  setExerciseActive,
  updateCoachExercise,
} from '../../lib/exerciseAdmin';
import { findOverrideFor } from '../../lib/exercises';
import type { ExerciseFormValues, LibraryEntry } from '../../lib/exercises';
import type { Feedback } from '../../lib/feedback';
import { t } from '../../i18n/he';
import { ExerciseLibraryView } from './ExerciseLibraryView';

export function ExerciseLibraryPage() {
  const { profile } = useAuth();
  const orgId = profile?.orgId ?? '';
  // ה-uid מגיע ממסמך הפרופיל ולא מ-user של Firebase: זה אותו מזהה, אבל כך כל
  // המסך נשען על מקור אחד — אותו מסמך שממנו מגיעים role ו-orgId.
  const coachUid = profile?.uid ?? '';

  const { status, entries, mine } = useExerciseLibrary(profile?.orgId, profile?.uid);

  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const handleCreate = useCallback(
    async (values: ExerciseFormValues): Promise<boolean> => {
      if (!orgId || !coachUid) return false;

      setFeedback(null);
      try {
        await createCoachExercise(values, orgId, coachUid);
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
    [orgId, coachUid],
  );

  const handleSave = useCallback(
    async (entry: LibraryEntry, values: ExerciseFormValues): Promise<boolean> => {
      if (!orgId || !coachUid) return false;

      setFeedback(null);
      try {
        if (entry.origin === 'catalog') {
          // עותק פרטי. אם כבר קיים עותק לאותו מקור — גם מבוטל — מעדכנים אותו
          // במקום ליצור שני. החיפוש הוא ברשימה שכבר בזיכרון, לא ב-getDoc.
          await saveExerciseOverride(
            entry.exercise,
            values,
            orgId,
            coachUid,
            findOverrideFor(mine, entry.sourceId),
          );
          setFeedback({
            tone: 'success',
            text: t('coach.exercises.form.overrideSuccess', { name: values.name.trim() }),
          });
          return true;
        }

        await updateCoachExercise(entry.exercise.id, values);
        setFeedback({
          tone: 'success',
          text: t('coach.exercises.form.editSuccess', { name: values.name.trim() }),
        });
        return true;
      } catch (error) {
        console.error('[CoachTrack] שמירת תרגיל נכשלה', error);
        setFeedback({ tone: 'error', text: t('coach.exercises.errors.saveFailed') });
        return false;
      }
    },
    [orgId, coachUid, mine],
  );

  /**
   * "חזרה למקור" — סימון העותק כלא-פעיל, לפי מזהה שנשמר על המסמך שכבר קראנו.
   * לא מחיקה, לא שאילתה, לא לולאה.
   */
  const handleRevert = useCallback(async (entry: LibraryEntry): Promise<boolean> => {
    setBusyId(entry.exercise.id);
    setFeedback(null);
    try {
      await revertExerciseOverride(entry.exercise.id);
      setFeedback({
        tone: 'success',
        text: t('coach.exercises.form.revertSuccess', { name: entry.exercise.name }),
      });
      return true;
    } catch (error) {
      console.error('[CoachTrack] החזרה לגרסת הקטלוג נכשלה', error);
      setFeedback({ tone: 'error', text: t('coach.exercises.errors.revertFailed') });
      return false;
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleSetActive = useCallback(
    async (entry: LibraryEntry, active: boolean): Promise<boolean> => {
      setBusyId(entry.exercise.id);
      setFeedback(null);
      try {
        await setExerciseActive(entry.exercise.id, active);
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
        entries={entries}
        onCreate={handleCreate}
        onSave={handleSave}
        onRevert={handleRevert}
        onSetActive={handleSetActive}
        busyId={busyId}
        feedback={feedback}
      />
    </AppShell>
  );
}
