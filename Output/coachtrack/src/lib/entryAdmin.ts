/**
 * CoachTrack — הכתיבות של הדיווח.
 *
 * כמו `lib/planAdmin.ts`: הקובץ הזה **לא מחליט**. כל חישוב (איזה תאריך, לאיזה
 * מחזור, מה חוקי) יושב ב-`lib/entries.ts` כפונקציה טהורה עם טסטים; כאן נשארו
 * שלוש קריאות ל-Firestore.
 *
 * ## שלושה דברים ששווה לדעת לפני שנוגעים
 *
 * 1. **`date` עובר תמיד דרך `toEntryDate`** (`entryDateForDay`) — Timestamp
 *    מקובע ל-12:00 בשעון ישראל. לא `new Date()`, לא מחרוזת, ולא חצות.
 *    זו מלכודת 1 ב-TASKS.md, והיא נסגרת בשורה אחת בלבד אם כולם עוברים דרכה.
 *
 * 2. **`createdAt` הוא `serverTimestamp()` ולא נגזר מהלקוח**, כי עליו נשען
 *    חלון העריכה של 7 ימים. שעון מכשיר שהוזז אחורה היה פותח חלון עריכה נצחי.
 *    בעדכון הוא **לא נשלח כלל** — `firestore.rules` דורשים שלא ישתנה.
 *
 * 3. **מחיקה היא `deleted: true`.** מחיקה קשיחה חסומה בכלל (`allow delete: if false`),
 *    ולא רק בממשק — כלל 5 ב-CLAUDE.md.
 */

import { addDoc, collection, doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db } from './firebase';
import { entryDateForDay } from './entries';
import type { DayKey } from './dates';
import type { EntryDoc } from '../types/types';

export interface CreateEntryInput {
  playerUid: string;
  teamId: string;
  orgId: string;
  exerciseId: string;
  amount: number;
  /** יום הביצוע בשעון ישראל, `yyyy-MM-dd`. */
  dayKey: DayKey;
  note: string;
  /** המחזור שאליו שייך יום הביצוע, או null. נגזר ב-`cycleIdForEntryDay`. */
  cycleId: string | null;
  /**
   * מי רשם. שונה מ-`playerUid` כשמאמן מזין עבור שחקן (שלב 5).
   * הכלל דורש `createdBy == request.auth.uid` — ערך אחר ייחסם.
   */
  createdBy: string;
}

/**
 * דיווח חדש — **מסמך נפרד בכל פעם, בלי צבירה במסמך אחד.**
 *
 * שני מכשירים שמדווחים במקביל לא דורסים זה את זה (PRD §8.4), והצבירה נעשית
 * בקריאה (`sumEntries`). זו גם הסיבה ש-`addDoc` כאן הוא הנכון, בניגוד למחזור
 * השבועי שדווקא חייב מזהה דטרמיניסטי.
 */
export async function createEntry(input: CreateEntryInput): Promise<string> {
  const reference = await addDoc(collection(db, 'entries'), {
    playerUid: input.playerUid,
    teamId: input.teamId,
    orgId: input.orgId,
    cycleId: input.cycleId,
    exerciseId: input.exerciseId,
    amount: input.amount,
    successAmount: null, // תשתית ליחס הצלחה — לא ב-MVP
    date: entryDateForDay(input.dayKey),
    note: input.note,
    createdAt: serverTimestamp(),
    createdBy: input.createdBy,
    deleted: false,
  });

  return reference.id;
}

export interface UpdateEntryInput {
  amount: number;
  dayKey: DayKey;
  note: string;
  /** נגזר מחדש מהתאריך החדש — עריכה שמזיזה יום עשויה להזיז גם שבוע. */
  cycleId: string | null;
}

/**
 * עריכת דיווח קיים.
 *
 * נשלחים ארבעה שדות בלבד. `playerUid`, `teamId`, `orgId`, `createdBy` ו-`createdAt`
 * אינם נשלחים כי `firestore.rules` דורשים שלא ישתנו — ושליחת אותו ערך אמנם
 * עוברת, אבל היא מזמינה את הבאג שבו מישהו ישנה את הערך "בטעות".
 */
export async function updateEntry(entryId: string, input: UpdateEntryInput): Promise<void> {
  await updateDoc(doc(db, 'entries', entryId), {
    amount: input.amount,
    date: entryDateForDay(input.dayKey),
    note: input.note,
    cycleId: input.cycleId,
  });
}

/** מחיקה רכה. ההיסטוריה נשמרת, האחוזים מפסיקים לספור אותה (`sumEntries`). */
export async function softDeleteEntry(entry: Pick<EntryDoc, 'id'>): Promise<void> {
  await updateDoc(doc(db, 'entries', entry.id), { deleted: true });
}
