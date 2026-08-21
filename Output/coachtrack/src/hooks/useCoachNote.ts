/**
 * הערת המאמן על שחקן — מאזין ל**מסמך בודד**, לא לקולקציה.
 *
 * ```ts
 * onSnapshot(doc(db, 'teams', teamId, 'notes', playerUid))
 * ```
 *
 * שלוש נקודות:
 *
 * 1. **מסמך בודד ולא שאילתה, ולכן אין כאן שאלה של אינדקסים או של סינון
 *    `orgId`.** הכלל "כל שאילתה מסוננת ב-orgId" (כלל 3) נועד למנוע שאילתה
 *    שנחסמת כולה; קריאת מסמך לפי נתיב מלא לא חשופה לזה. הבידוד נאכף בכלל
 *    עצמו דרך `isTeamCoach(teamId)` מהנתיב.
 *
 * 2. **מסמך שאינו קיים הוא מצב תקין, לא שגיאה.** לרוב השחקנים לא תהיה הערה
 *    לעולם, והמסך צריך להראות שדה ריק. `snapshot.exists()` שקרי → טקסט ריק.
 *
 * 3. **ה-effect תלוי ב-`teamId` וב-`playerUid` ורץ רק כששניהם קיימים** —
 *    כלומר אחרי שהפרופיל נטען ואחרי שהמאמן בחר שחקן. מאזין שנרשם מוקדם מדי
 *    מקבל PERMISSION_DENIED מהכלל שעושה `get()` על מסמך המשתמש.
 */

import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { coachNotePath } from '../lib/coachNotes';
import type { CoachNote } from '../types/types';
import type { LoadStatus } from './loadStatus';

export interface CoachNoteState {
  status: LoadStatus;
  /** הטקסט השמור. מחרוזת ריקה כשאין הערה. */
  text: string;
  /** מתי נשמר לאחרונה, או null כשאין הערה. */
  updatedAt: Date | null;
}

interface CoachNoteSnapshot extends CoachNoteState {
  path: string;
}

export function useCoachNote(
  teamId: string | undefined,
  playerUid: string | undefined,
): CoachNoteState {
  const [snapshotState, setSnapshotState] = useState<CoachNoteSnapshot | null>(null);

  useEffect(() => {
    if (!teamId || !playerUid) return;
    const path = coachNotePath(teamId, playerUid);

    return onSnapshot(
      doc(db, path),
      (snapshot) => {
        const data = snapshot.exists() ? (snapshot.data() as CoachNote) : null;
        setSnapshotState({
          path,
          status: 'ready',
          text: data?.text ?? '',
          // updatedAt חוזר null בזמן שה-serverTimestamp עוד בדרך מהשרת.
          updatedAt: data?.updatedAt ? data.updatedAt.toDate() : null,
        });
      },
      (error) => {
        console.error('[CoachTrack] טעינת הערת המאמן נכשלה', error);
        setSnapshotState({ path, status: 'error', text: '', updatedAt: null });
      },
    );
  }, [teamId, playerUid]);

  const path = teamId && playerUid ? coachNotePath(teamId, playerUid) : null;
  // הערה של שחקן קודם לא נחשבת — אחרת הערה על אחד הייתה מוצגת על אחר.
  const fresh = path && snapshotState?.path === path ? snapshotState : null;

  return {
    status: fresh ? fresh.status : 'loading',
    text: fresh ? fresh.text : '',
    updatedAt: fresh ? fresh.updatedAt : null,
  };
}
