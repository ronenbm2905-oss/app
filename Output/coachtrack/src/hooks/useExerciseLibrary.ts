/**
 * ספריית התרגילים — **שתי שאילתות, לא אחת.**
 *
 * ```ts
 * query(collection(db, 'exercises'), where('scope',    '==', 'global'))
 * query(collection(db, 'exercises'), where('coachUid', '==', uid))
 * ```
 *
 * ## למה שתיים
 *
 * כלל הקריאה על exercises הוא **"או" לוגי**: גלובלי לכולם, תרגיל של מאמן
 * לבעליו בלבד. שאילתה אחת שתכסה את שני הצדדים לא קיימת, ושאילתה בלי `where`
 * נחסמת כולה (אומת מול המסד החי, 20.8.2026: `collection('exercises')` מוחזרת
 * כ-PERMISSION_DENIED, ואילו `.where('scope','==','global')` עובדת).
 *
 * `or()` של Firestore לא היה עוזר: הערכת ההרשאות נעשית מול כל מסמך שהשאילתה
 * *עלולה* להחזיר. שני מאזינים נפרדים + מיזוג בלקוח הם הפתרון הפשוט והבטוח —
 * ובנפח הזה (30 + קומץ) גם הזול.
 *
 * ## שוויון בודד בכל שאילתה — בכוונה
 *
 * בשתיהן יש **תנאי שוויון אחד בלבד**, ולכן אף אחת מהן לא דורשת אינדקס מורכב.
 * זה אילוץ מבצעי ולא העדפה: פריסת אינדקסים (`firebase deploy`) חסומה לסוכן.
 * מכאן גם שאין `where('active','==',true)` — שוויון שני. הסינון של תרגילים
 * מושבתים נעשה בלקוח.
 *
 * ## למה נעלם המאזין על orgId
 *
 * עד 25.8.2026 המאזין השני היה `where('orgId','==',orgId)`. מרגע שלכל מאמן יש
 * עותקים פרטיים — כולם נושאים את ה-`orgId` של האגודה — אותה שאילתה הייתה סוחפת
 * את **העותקים הפרטיים של המאמנים האחרים** באותה אגודה. היא לא רק הייתה מציגה
 * למאמן דברים שאינם שלו: מרגע שהכלל אוסר עליו לקרוא אותם, **כל השאילתה נופלת**
 * ב-PERMISSION_DENIED. יש על כך בדיקת rules ייעודית.
 *
 * תרגילי `scope: 'org'` (משותפים לארגון) אינם נטענים יותר. במסד היו 0 כאלה
 * ברגע השינוי, והאפליקציה כבר לא יוצרת אותם.
 */

import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { buildExerciseLibrary, libraryExercises } from '../lib/exercises';
import type { LibraryEntry } from '../lib/exercises';
import type { Exercise, ExerciseDoc } from '../types/types';
import type { LoadStatus } from './loadStatus';

export interface ExerciseLibraryState {
  status: LoadStatus;
  /** הרשימה שעל המסך: קטלוג + תרגילי המאמן, אחרי הסתרה ומיון. */
  entries: LibraryEntry[];
  /** אותה רשימה בלי סיווג — הקלט של בורר התרגילים בתוכנית. */
  exercises: ExerciseDoc[];
  /**
   * כל התרגילים של המאמן, **כולל עותקים מבוטלים**.
   * דרוש כדי למצוא עותק קיים לפני יצירת אחד חדש (`findOverrideFor`).
   */
  mine: ExerciseDoc[];
  /** כמה תרגילי קטלוג חזרו — הנתון שמאמת "30 תרגילים בספרייה". */
  globalCount: number;
}

/**
 * מצב שני המאזינים יחד. `null` באחד המקורות = עוד לא חזר.
 * ה-key נשמר כדי שתוצאה של משתמש או ארגון קודם לא תיחשב.
 */
interface LibrarySnapshot {
  key: string;
  global: ExerciseDoc[] | null;
  mine: ExerciseDoc[] | null;
  failed: boolean;
}

const NO_EXERCISES: ExerciseDoc[] = [];

function toDocs(docs: { id: string; data: () => unknown }[]): ExerciseDoc[] {
  return docs.map((document) => ({ ...(document.data() as Exercise), id: document.id }));
}

export function useExerciseLibrary(
  orgId: string | undefined,
  coachUid: string | undefined,
): ExerciseLibraryState {
  const [snapshotState, setSnapshotState] = useState<LibrarySnapshot | null>(null);
  const key = `${orgId ?? ''}|${coachUid ?? ''}`;

  useEffect(() => {
    if (!orgId || !coachUid) return;

    /** עדכון חלקי שמאפס מעצמו כשמדובר במשתמש אחר. */
    const patch = (changes: Partial<Omit<LibrarySnapshot, 'key'>>) => {
      setSnapshotState((previous) =>
        previous && previous.key === key
          ? { ...previous, ...changes }
          : { key, global: null, mine: null, failed: false, ...changes },
      );
    };

    const globalQuery = query(collection(db, 'exercises'), where('scope', '==', 'global'));
    const mineQuery = query(collection(db, 'exercises'), where('coachUid', '==', coachUid));

    const unsubscribeGlobal = onSnapshot(
      globalQuery,
      (snapshot) => patch({ global: toDocs(snapshot.docs) }),
      (error) => {
        console.error('[CoachTrack] טעינת הקטלוג הגלובלי נכשלה', error);
        patch({ failed: true });
      },
    );

    const unsubscribeMine = onSnapshot(
      mineQuery,
      (snapshot) => patch({ mine: toDocs(snapshot.docs) }),
      (error) => {
        console.error('[CoachTrack] טעינת התרגילים של המאמן נכשלה', error);
        patch({ failed: true });
      },
    );

    return () => {
      unsubscribeGlobal();
      unsubscribeMine();
    };
  }, [orgId, coachUid, key]);

  const fresh = orgId && coachUid && snapshotState?.key === key ? snapshotState : null;
  const globalExercises = fresh?.global ?? NO_EXERCISES;
  const mine = fresh?.mine ?? NO_EXERCISES;

  const entries = useMemo(
    () => buildExerciseLibrary(globalExercises, mine),
    [globalExercises, mine],
  );
  const exercises = useMemo(() => libraryExercises(entries), [entries]);

  // "מוכן" רק כששני המאזינים חזרו — אחרת הרשימה מהבהבת מ-30 ל-31 ולהיפך.
  const status: LoadStatus = !fresh
    ? 'loading'
    : fresh.failed
      ? 'error'
      : fresh.global && fresh.mine
        ? 'ready'
        : 'loading';

  return { status, entries, exercises, mine, globalCount: globalExercises.length };
}
