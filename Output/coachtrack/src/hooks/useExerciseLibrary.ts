/**
 * ספריית התרגילים — **שתי שאילתות, לא אחת.**
 *
 * ```ts
 * query(collection(db, 'exercises'), where('scope', '==', 'global'))
 * query(collection(db, 'exercises'), where('orgId', '==', orgId))
 * ```
 *
 * כלל הקריאה על exercises הוא:
 * resource.data.scope == 'global' || sameOrg(resource.data.orgId) — **או** לוגי.
 * שאילתה אחת שתכסה את שני הצדדים לא קיימת, ושאילתה בלי where נחסמת כולה
 * (אומת מול המסד החי, 20.8.2026: collection('exercises') מוחזרת כ-PERMISSION_DENIED,
 * ואילו .where('scope','==','global') עובדת).
 *
 * or() של Firestore לא היה עוזר: הערכת ההרשאות נעשית מול כל מסמך שהשאילתה
 * *עלולה* להחזיר. שני מאזינים נפרדים + מיזוג בלקוח הם הפתרון הפשוט והבטוח —
 * ובנפח הזה (30 + קומץ) גם הזול.
 *
 * שים לב שאין where('active', '==', true): שוויון שני היה דורש אינדקס מורכב,
 * ופריסת אינדקסים חסומה לסוכן. תרגילים מושבתים מסומנים בממשק במקום להיעלם —
 * ממילא אין מחיקה קשיחה, והמאמן צריך דרך להפעיל אותם מחדש.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { mergeExerciseSources } from '../lib/exercises';
import type { Exercise, ExerciseDoc } from '../types/types';
import type { LoadStatus } from './loadStatus';

export interface ExerciseLibraryState {
  status: LoadStatus;
  /** הקטלוג הגלובלי והתרגילים של הארגון, ממוזגים וממוינים. */
  exercises: ExerciseDoc[];
  /** כמה מתוכם גלובליים — הנתון שמאמת "30 תרגילים בספרייה". */
  globalCount: number;
}

/**
 * מצב שני המאזינים יחד. `null` באחד המקורות = עוד לא חזר.
 * ה-orgId נשמר כדי שתוצאה של ארגון קודם לא תיחשב.
 */
interface LibrarySnapshot {
  orgId: string;
  global: ExerciseDoc[] | null;
  org: ExerciseDoc[] | null;
  failed: boolean;
}

const NO_EXERCISES: ExerciseDoc[] = [];

function toDocs(docs: { id: string; data: () => unknown }[]): ExerciseDoc[] {
  return docs.map((document) => ({ ...(document.data() as Exercise), id: document.id }));
}

export function useExerciseLibrary(orgId: string | undefined): ExerciseLibraryState {
  const [snapshotState, setSnapshotState] = useState<LibrarySnapshot | null>(null);

  useEffect(() => {
    if (!orgId) return;

    /** עדכון חלקי שמאפס מעצמו כשמדובר בארגון אחר. */
    const patch = (changes: Partial<Omit<LibrarySnapshot, 'orgId'>>) => {
      setSnapshotState((previous) =>
        previous && previous.orgId === orgId
          ? { ...previous, ...changes }
          : { orgId, global: null, org: null, failed: false, ...changes },
      );
    };

    const globalQuery = query(collection(db, 'exercises'), where('scope', '==', 'global'));
    const orgQuery = query(collection(db, 'exercises'), where('orgId', '==', orgId));

    const unsubscribeGlobal = onSnapshot(
      globalQuery,
      (snapshot) => patch({ global: toDocs(snapshot.docs) }),
      (error) => {
        console.error('[CoachTrack] טעינת הקטלוג הגלובלי נכשלה', error);
        patch({ failed: true });
      },
    );

    const unsubscribeOrg = onSnapshot(
      orgQuery,
      (snapshot) => patch({ org: toDocs(snapshot.docs) }),
      (error) => {
        console.error('[CoachTrack] טעינת תרגילי הארגון נכשלה', error);
        patch({ failed: true });
      },
    );

    return () => {
      unsubscribeGlobal();
      unsubscribeOrg();
    };
  }, [orgId]);

  const fresh = orgId && snapshotState?.orgId === orgId ? snapshotState : null;
  const globalExercises = fresh?.global ?? NO_EXERCISES;
  const orgExercises = fresh?.org ?? NO_EXERCISES;

  const exercises = useMemo(
    () => mergeExerciseSources(globalExercises, orgExercises),
    [globalExercises, orgExercises],
  );

  // "מוכן" רק כששני המאזינים חזרו — אחרת הרשימה מהבהבת מ-30 ל-31 ולהיפך.
  const status: LoadStatus = !fresh
    ? 'loading'
    : fresh.failed
      ? 'error'
      : fresh.global && fresh.org
        ? 'ready'
        : 'loading';

  return { status, exercises, globalCount: globalExercises.length };
}
