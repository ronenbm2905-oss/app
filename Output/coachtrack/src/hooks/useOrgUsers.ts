/**
 * מאזין חי למשתמשי הארגון.
 *
 * ## השאילתה, ולמה בדיוק ככה
 *
 * ```ts
 * query(collection(db, 'users'), where('orgId', '==', orgId))
 * ```
 *
 * 1. **הסינון ב-orgId הוא חובה, לא נימוס.** כלל הקריאה על users מתיר למאמן
 *    לקרוא מסמך רק אם sameOrg(resource.data.orgId). שאילתה בלי ה-where הזה
 *    *עלולה* להחזיר מסמך של ארגון אחר, ולכן Firestore חוסם אותה **כולה** —
 *    גם כשבפועל יש ארגון אחד בלבד. "כללים הם לא מסננים" (CLAUDE.md).
 *
 * 2. **אין where('teamIds', 'array-contains', teamId).** צירוף שלו עם השוויון
 *    על orgId דורש אינדקס מורכב, ופריסת אינדקסים חסומה לסוכן. הסינון לפי
 *    קבוצה נעשה בצד הלקוח (lib/players.ts), וזה זניח ב-13–18 שחקנים.
 *
 * 3. **אין orderBy('displayName').** גם הוא היה מצריך אינדקס מורכב יחד עם
 *    השוויון על orgId. המיון נעשה בלקוח, עם localeCompare('he') — שממילא
 *    נכון יותר לעברית מסדר היוניקוד ש-Firestore היה מחזיר.
 *
 * המאזין נרשם רק כשיש orgId, שמגיע ממסמך users/{uid} של המשתמש המחובר —
 * כלומר בהכרח **אחרי** שההתחברות הושלמה. מאזין שנרשם לפני זה מקבל
 * PERMISSION_DENIED ומתורגם על המסך ל"טעינה נכשלה" בלי סיבה נראית לעין.
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { User, UserDoc } from '../types/types';
import type { LoadStatus } from './loadStatus';

export interface OrgUsersState {
  status: LoadStatus;
  users: UserDoc[];
}

/** התוצאה נושאת איתה את ה-orgId שהיא שייכת לו, כדי שהחלפת ארגון לא תציג נתונים ישנים. */
interface OrgUsersSnapshot extends OrgUsersState {
  orgId: string;
}

export function useOrgUsers(orgId: string | undefined): OrgUsersState {
  const [snapshotState, setSnapshotState] = useState<OrgUsersSnapshot | null>(null);

  useEffect(() => {
    if (!orgId) return;

    const usersQuery = query(collection(db, 'users'), where('orgId', '==', orgId));

    return onSnapshot(
      usersQuery,
      (snapshot) => {
        const users = snapshot.docs.map((document) => ({
          ...(document.data() as User),
          uid: document.id,
        }));
        setSnapshotState({ orgId, status: 'ready', users });
      },
      (error) => {
        console.error('[CoachTrack] טעינת משתמשי הארגון נכשלה', error);
        setSnapshotState({ orgId, status: 'error', users: [] });
      },
    );
  }, [orgId]);

  // המצב נגזר בזמן הרינדור ולא מאופס בתוך ה-effect: כך אין רינדור כפול,
  // ותוצאה שנשארה מארגון קודם פשוט לא נחשבת.
  if (!orgId || snapshotState?.orgId !== orgId) {
    return { status: 'loading', users: [] };
  }

  return { status: snapshotState.status, users: snapshotState.users };
}
