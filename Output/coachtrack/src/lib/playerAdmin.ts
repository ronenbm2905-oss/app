/**
 * CoachTrack — כתיבות על מסמכי שחקנים (מלבד היצירה, שיושבת ב-`adminClient.ts`).
 *
 * ⚠️ אין כאן מחיקה, ולא תהיה: כלל 5 — אין מחיקה קשיחה — נאכף ב-`firestore.rules`
 * עם `allow delete: if false`. שחקן שעזב מסומן `active: false`, וההיסטוריה שלו
 * נשארת שלמה. גם הדרך חזרה קיימת (`active: true`), כי שחקן שחזר מפציעה הוא
 * מקרה נפוץ יותר משחקן שנמחק בטעות.
 */

import { doc, updateDoc } from 'firebase/firestore';
import { db } from './firebase';

/**
 * השבתה או הפעלה מחדש של שחקן.
 *
 * ה-rules מתירים את זה למאמן על מסמכים שהם `role: 'player'` בארגון שלו בלבד.
 * שים לב ש-`active` הוא אחד מארבעת השדות שחסומים לעדכון-**עצמי** — כלומר שחקן
 * לא יכול להפעיל את עצמו מחדש, ובדיוק לשם כך הכלל קיים.
 */
export async function setPlayerActive(uid: string, active: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { active });
}
