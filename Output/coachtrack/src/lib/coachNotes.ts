/**
 * CoachTrack — הערות המאמן על שחקן (PRD §7.3ג).
 *
 * ## איפה ההערה יושבת, ולמה דווקא שם
 *
 * `teams/{teamId}/notes/{playerUid}` — תת-קולקציה, ולא שדה במסמך `users/{uid}`
 * ולא קולקציה שטוחה. שתי סיבות, ושתיהן הרשאות:
 *
 * 1. **שחקן קורא את מסמך `users/{uid}` של עצמו.** הערה שהייתה יושבת שם הייתה
 *    גלויה לו — לא באפליקציה, אבל בכל קריאה ישירה ל-Firestore. "לא נראה
 *    לשחקן" חייב להיות כלל, לא הסתרה בממשק (כלל 4 ב-CLAUDE.md).
 *
 * 2. **הזהות של ההערה היא הנתיב, לא שדה תוכן.** הכלל שואל `isTeamCoach(teamId)`
 *    מתוך הנתיב עצמו, ולכן אינו נוגע ב-`resource.data` — וכך גם **קריאה של
 *    הערה שעדיין לא קיימת** עוברת. כלל שקורא `resource.data.teamId` היה
 *    מחזיר PERMISSION_DENIED על כל שחקן שאין לו עדיין הערה, וזה נראה בדיוק
 *    כמו תקלה. זו אותה מוסכמה של תיקון "זהות מסמך אינה שדה תוכן".
 *
 * ## הדגל המשפטי שפתוח על השדה הזה
 *
 * ⚠️ עדי סימנה את הערות המאמן כדגל **החמור ביותר** ב-M1 (סקירת 21.8.2026):
 * "הערכת אישיות שנערכה מטעם גורם מקצועי באשר לקווי אופי" היא **מידע רגיש**
 * לפי תיקון 13 לחוק הגנת הפרטיות, ומאמן הוא בדיוק גורם כזה. ההכרעה טרם נפלה.
 *
 * עד שתיפול, השדה מקבל **בדיוק אותו טיפול כמו שדה ההערה של השחקן**
 * (`NOTE_MAX_LENGTH` ב-`lib/entries.ts`): הוא נבנה כפי שה-PRD מבקש, עם אורך
 * מוגבל ועם טקסט עזר עובדתי שמגביל מה נכתב בו. הגבלת האורך היא מיתון אמיתי —
 * 400 תווים מספיקים ל"פספס שלושה שבועות ברצף, לדבר איתו" ולא מספיקים לתיק
 * אישי — והיא נאכפת גם ב-`firestore.rules`, לא רק ב-`maxLength` של השדה.
 */

import type { TranslationKey } from '../i18n/he';

/**
 * אורך ההערה. ארוך פי שניים מהערת השחקן, כי המאמן כותב על פני עונה שלמה —
 * וקצר בהרבה ממה שנדרש לתיאור אישיות. ראה את אזהרת תיקון 13 למעלה.
 */
export const COACH_NOTE_MAX_LENGTH = 400;

/** הנתיב למסמך ההערה. מקום אחד שמרכיב אותו — ה-hook והכתיבה קוראים לו. */
export function coachNotePath(teamId: string, playerUid: string): string {
  return `teams/${teamId}/notes/${playerUid}`;
}

/** מה שנשמר בפועל: רווחים מיותרים בקצוות אינם תוכן. */
export function normalizeCoachNote(text: string): string {
  return (text ?? '').trim();
}

/** ולידציה. מפתח תרגום ולא טקסט (כלל 8), `null` כשהכול תקין. */
export function validateCoachNote(text: string): TranslationKey | null {
  if ((text ?? '').length > COACH_NOTE_MAX_LENGTH) {
    return 'coach.player.note.errors.tooLong';
  }
  return null;
}

/**
 * האם יש מה לשמור.
 *
 * ההשוואה היא על הערך המנורמל: לחיצה על "שמירה" אחרי הוספת רווח בסוף לא
 * אמורה לכתוב למסד, ובעיקר לא אמורה לעדכן את `updatedAt` בלי סיבה.
 */
export function isCoachNoteDirty(saved: string, draft: string): boolean {
  return normalizeCoachNote(saved) !== normalizeCoachNote(draft);
}
