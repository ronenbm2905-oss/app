/**
 * CoachTrack — הכתיבה של הערת המאמן.
 *
 * כמו `lib/entryAdmin.ts`: כאן אין החלטות. הנתיב, האורך המותר והנרמול יושבים
 * ב-`lib/coachNotes.ts` עם טסטים; כאן נשארה קריאה אחת ל-Firestore.
 *
 * `setDoc` ולא `updateDoc`, כי ההערה הראשונה לשחקן יוצרת את המסמך. אין `merge`
 * בכוונה: המסמך מכיל שלושה שדות בלבד וכולם נכתבים יחד, ומיזוג היה משאיר
 * `updatedBy` ישן לצד טקסט חדש.
 *
 * ⚠️ **מחיקת הערה = כתיבת מחרוזת ריקה.** מחיקה קשיחה חסומה בכלל
 * (`allow delete: if false`, כלל 5), והיא גם לא נחוצה: Firestore לא שומר
 * גרסאות, ולכן דריסה בטקסט ריק מוחקת את התוכן בפועל — וזו דרך המחיקה שהמסך
 * מציע למאמן.
 */

import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { coachNotePath, normalizeCoachNote } from './coachNotes';

export interface SaveCoachNoteInput {
  teamId: string;
  playerUid: string;
  text: string;
  /** ה-uid של המאמן. הכלל דורש `updatedBy == request.auth.uid`. */
  coachUid: string;
}

export async function saveCoachNote({
  teamId,
  playerUid,
  text,
  coachUid,
}: SaveCoachNoteInput): Promise<void> {
  await setDoc(doc(db, coachNotePath(teamId, playerUid)), {
    text: normalizeCoachNote(text),
    updatedAt: serverTimestamp(),
    updatedBy: coachUid,
  });
}
