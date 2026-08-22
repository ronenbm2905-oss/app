/**
 * העתקה ללוח — הפעולה היחידה בשלב 6 שנוגעת ב-API של הדפדפן.
 *
 * ## למה זה לא שורה אחת
 *
 * `navigator.clipboard.writeText` נכשל בשלושה מצבים שכולם ריאליים כאן:
 *
 * 1. **הקשר לא מאובטח.** ה-API קיים רק ב-HTTPS או ב-localhost. הדרך שבה
 *    רונן בודק בטלפון היא `npm run dev` עם `host: true`, כלומר
 *    `http://192.168.x.x:5173` — הקשר לא מאובטח, ו-`navigator.clipboard`
 *    שם הוא `undefined`. בלי fallback, הכפתור המרכזי של שלב 6 פשוט לא עובד
 *    בדיוק בסביבה שבה בודקים אותו.
 * 2. **הרשאה שנדחתה** או דפדפן שדורש מחווה שלא זוהתה.
 * 3. **Safari בגרסאות ישנות** — `execCommand` הוא המסלול היחיד.
 *
 * לכן: ניסיון ב-API המודרני, ואם הוא נופל — `textarea` זמני מחוץ למסך עם
 * `document.execCommand('copy')`. ואם גם זה נופל, הפונקציה מחזירה `false`
 * והמסך מציג את הטקסט לבחירה ידנית. **בשום מסלול אין זריקה** — כפתור
 * "העתק" שמפיל מסך הוא גרוע מכפתור שלא מעתיק.
 */

/**
 * מעתיק טקסט ללוח. מחזירה האם ההעתקה הצליחה.
 *
 * ⚠️ חייבת להיקרא בתוך מחווה של המשתמש (click), אחרת שני המסלולים נדחים.
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (error) {
      // לא מדווחים כשגיאה: הכשל צפוי ב-http, ויש מסלול שני.
      console.warn('[CoachTrack] העתקה דרך navigator.clipboard נכשלה, עוברים ל-fallback', error);
    }
  }

  return legacyCopy(text);
}

/**
 * מסלול ה-fallback.
 *
 * ה-`textarea` חייב להיות **בתוך ה-DOM וניתן למיקוד** כדי ש-`execCommand`
 * יעבוד, ולכן הוא לא `display: none`. הוא מוזז מחוץ למסך עם `position: fixed`
 * ו-`opacity: 0` במקום, ומוסר ב-`finally` גם כשנזרקה שגיאה.
 *
 * `dir="ltr"` מכוון: הטקסט עצמו עברי, אבל ה-textarea הזה לא נראה לאיש —
 * מה שחשוב הוא שהתוכן ייבחר במלואו, וזה לא תלוי בכיוון.
 */
function legacyCopy(text: string): boolean {
  if (typeof document === 'undefined') return false;

  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.setAttribute('aria-hidden', 'true');
  area.style.position = 'fixed';
  area.style.top = '0';
  area.style.insetInlineStart = '-9999px';
  area.style.opacity = '0';

  document.body.appendChild(area);

  try {
    area.select();
    // iOS מתעלם מ-select() על textarea לקריאה בלבד; setSelectionRange כן עובד.
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch (error) {
    console.error('[CoachTrack] העתקה ללוח נכשלה', error);
    return false;
  } finally {
    document.body.removeChild(area);
  }
}
