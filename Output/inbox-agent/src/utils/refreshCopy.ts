// ============================================================================
// refreshCopy.ts — שני המשפטים שהכפתור "לבדוק אם הגיעו הזמנות חדשות" אומר.
//
// ---------------------------------------------------------------------------
// למה זה פונקציות טהורות ולא JSX
// ---------------------------------------------------------------------------
// שתי ההחלטות כאן הן החלטות **ניסוח שתלויות במספר** — אפס/אחת/רבות, והיום/
// לא-היום. ניסוח שיושב בתוך JSX נבדק רק אם מישהו מרנדר את המסך עם בדיוק
// הנתונים הנכונים; פונקציה טהורה נבדקת ישירות, וזה מה שקורה
// ב-`tests/refreshControl.test.tsx`.
//
// ---------------------------------------------------------------------------
// ★ "אפס" הוא תשובה, לא היעדר תשובה
// ---------------------------------------------------------------------------
// `refreshResultHe(0)` מחזיר משפט מלא ולא מחרוזת ריקה. זה העיקר: משתמשת
// שלוחצת ורואה מסך שלא השתנה מסיקה שהכפתור לא עובד. משתמשת שרואה
// "בדקתי עכשיו — לא הגיעו הזמנות חדשות" יודעת בדיוק מה קרה.
// ============================================================================

import { HE } from '../i18n';

/** המשפט שמופיע אחרי ריצה שהצליחה. `0` מקבל ניסוח משלו — ראה למעלה. */
export function refreshResultHe(newCount: number): string {
  if (newCount <= 0) return HE.refreshNoneNew;
  if (newCount === 1) return HE.refreshOneNew;
  return `${HE.refreshManyPrefix} ${newCount} ${HE.refreshManySuffix}`;
}

/**
 * ★ "בדקתי לאחרונה ב-08:14".
 *
 * אותו יום → שעה בלבד, כי זה כל מה שצריך כדי לדעת אם התמונה עדכנית.
 * יום אחר → תאריך **ואז** שעה, כי "08:14" לבדו על נתון מלפני יומיים הוא
 * בדיוק סוג ההצגה שגורם לחשוב שהמצב עדכני כשהוא לא.
 *
 * `iso === null` → "עוד לא בדקתי". זה המצב מיד אחרי החיבור, לפני שהריצה
 * האוטומטית הספיקה להסתיים.
 */
export function lastCheckedHe(iso: string | null, now: Date = new Date()): string {
  if (!iso) return HE.refreshNeverChecked;

  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return HE.refreshNeverChecked;

  const time = at.toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
  const sameDay =
    at.getFullYear() === now.getFullYear() &&
    at.getMonth() === now.getMonth() &&
    at.getDate() === now.getDate();

  if (sameDay) return `${HE.refreshLastCheckedPrefix}${time}`;

  const date = at.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' });
  return `${HE.refreshLastCheckedPrefix}${date} ${HE.refreshLastCheckedAtHour} ${time}`;
}
