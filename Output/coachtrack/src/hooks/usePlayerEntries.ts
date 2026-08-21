/**
 * הדיווחים של השחקן — **מאזין אחד, שוויון בודד.**
 *
 * ```ts
 * query(collection(db, 'entries'), where('playerUid', '==', playerUid))
 * ```
 *
 * ⚠️ שלוש הערות שכל אחת מהן היא באג שכבר קרה בפרויקט הזה:
 *
 * 1. **הסינון ב-`playerUid` הוא חלק מההרשאה, לא אופטימיזציה** (מלכודת 8).
 *    כלל הקריאה הוא `resource.data.playerUid == request.auth.uid`, ו-Firestore
 *    לא מסנן החוצה מסמכים אסורים — שאילתה בלי ה-`where` הזה נחסמת **כולה**,
 *    גם אם במסד יש רק דיווחים של השחקן עצמו.
 *
 * 2. **בלי `orderBy` ובלי `where` שני.** שוויון + מיון על שדה אחר דורשים
 *    אינדקס מורכב, ופריסת אינדקסים חסומה לסוכן. המיון והחיתוך לשבועות נעשים
 *    בלקוח (`lib/entries.ts`), על סדר גודל של מאות מסמכים לעונה.
 *
 * 3. **ה-effect תלוי ב-`playerUid` ורץ רק כשיש כזה.** הוא מגיע ממסמך הפרופיל,
 *    כלומר אחרי ש-`AuthProvider` סיים. מאזין שנרשם לפני זה מקבל
 *    `PERMISSION_DENIED` — הכלל עושה `get()` על `users/{uid}` שעוד לא נקרא —
 *    והמסך מציג "טעינה נכשלה" בלי סיבה נראית לעין.
 */

import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Entry, EntryDoc } from '../types/types';
import type { LoadStatus } from './loadStatus';

export interface PlayerEntriesState {
  status: LoadStatus;
  /** כל הדיווחים של השחקן, כולל מחוקים-רכות. הסינון נעשה בשכבת החישוב. */
  entries: EntryDoc[];
}

interface EntriesSnapshot extends PlayerEntriesState {
  playerUid: string;
}

const NO_ENTRIES: EntryDoc[] = [];

export function usePlayerEntries(playerUid: string | undefined): PlayerEntriesState {
  const [snapshotState, setSnapshotState] = useState<EntriesSnapshot | null>(null);

  useEffect(() => {
    if (!playerUid) return;

    return onSnapshot(
      query(collection(db, 'entries'), where('playerUid', '==', playerUid)),
      (snapshot) => {
        setSnapshotState({
          playerUid,
          status: 'ready',
          entries: snapshot.docs.map((document) => ({
            ...(document.data() as Entry),
            id: document.id,
          })),
        });
      },
      (error) => {
        console.error('[CoachTrack] טעינת הדיווחים נכשלה', error);
        setSnapshotState({ playerUid, status: 'error', entries: [] });
      },
    );
  }, [playerUid]);

  // תוצאה של שחקן קודם לא נחשבת — אותה הגנה כמו בשאר ה-hooks.
  const fresh = playerUid && snapshotState?.playerUid === playerUid ? snapshotState : null;

  return {
    status: fresh ? fresh.status : 'loading',
    entries: fresh ? fresh.entries : NO_ENTRIES,
  };
}
