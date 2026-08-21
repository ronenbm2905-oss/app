/**
 * הדיווחים של **הקבוצה** — מאזין אחד, שוויון בודד.
 *
 * ```ts
 * query(collection(db, 'entries'), where('teamId', '==', teamId))
 * ```
 *
 * ⚠️ ארבע נקודות, וכל אחת מהן החלטה ולא ברירת מחדל:
 *
 * 1. **הסינון ב-`teamId` הוא חלק מההרשאה** (מלכודת 8). כלל הקריאה של המאמן
 *    הוא `isTeamCoach(resource.data.teamId)`, ו-Firestore לא מסנן החוצה
 *    מסמכים אסורים — שאילתה בלי ה-`where` הזה נחסמת **כולה**. זה גם למה אין
 *    כאן `where('playerUid', ...)`: החיתוך לשחקן נעשה בלקוח
 *    (`dashboard.entriesForPlayer`).
 *
 * 2. **בלי טווח תאריכים ובלי `orderBy`.** `teamId + date` היה דורש אינדקס
 *    מורכב, ופריסת אינדקסים חסומה לסוכן. המשמעות: נטענים דיווחי **העונה
 *    כולה**. בקבוצה של 18 שחקנים × 5 תרגילים × 40 שבועות מדובר בסדר גודל של
 *    אלפי מסמכים קטנים — כבד יותר ממסך השחקן, וסביר לחלוטין ל-MVP. הפתרון
 *    האמיתי לסקייל הוא `weeklySummaries` (שלב 2), לא אינדקס.
 *
 * 3. **ה-effect תלוי ב-`teamId` ורץ רק אחרי שיש פרופיל.** מאזין שנרשם לפני
 *    שההתחברות הושלמה מקבל PERMISSION_DENIED — הכלל עושה `get()` על
 *    `users/{uid}` שעוד לא נקרא — והמסך מציג "טעינה נכשלה" בלי סיבה נראית.
 *
 * 4. **מחוקים-רכות נטענים גם הם.** הסינון קורה בשכבת החישוב
 *    (`buildTeamMatrix` דרך `visibleEntries`), כדי שיומן הדיווחים של המאמן
 *    יוכל להציג מה נמחק — זה בדיוק המידע שהוא צריך כשמספר לא מסתדר.
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Entry, EntryDoc } from '../types/types';
import type { LoadStatus } from './loadStatus';

export interface TeamEntriesState {
  status: LoadStatus;
  /** כל דיווחי הקבוצה, כולל מחוקים-רכות. */
  entries: EntryDoc[];
}

interface TeamEntriesSnapshot extends TeamEntriesState {
  teamId: string;
}

const NO_ENTRIES: EntryDoc[] = [];

export function useTeamEntries(teamId: string | undefined): TeamEntriesState {
  const [snapshotState, setSnapshotState] = useState<TeamEntriesSnapshot | null>(null);

  useEffect(() => {
    if (!teamId) return;

    return onSnapshot(
      query(collection(db, 'entries'), where('teamId', '==', teamId)),
      (snapshot) => {
        setSnapshotState({
          teamId,
          status: 'ready',
          entries: snapshot.docs.map((document) => ({
            ...(document.data() as Entry),
            id: document.id,
          })),
        });
      },
      (error) => {
        console.error('[CoachTrack] טעינת דיווחי הקבוצה נכשלה', error);
        setSnapshotState({ teamId, status: 'error', entries: [] });
      },
    );
  }, [teamId]);

  // תוצאה של קבוצה קודמת לא נחשבת — אותה הגנה כמו בשאר ה-hooks.
  const fresh = teamId && snapshotState?.teamId === teamId ? snapshotState : null;

  return {
    status: fresh ? fresh.status : 'loading',
    entries: fresh ? fresh.entries : NO_ENTRIES,
  };
}
