// ============================================================================
// task.ts — משימה, והשדות שעוצרים לולאות סנכרון.
//
// פרוסה 0 היא localStorage בלבד ובלי יומן, ובכל זאת שדות הסנכרון קיימים כאן
// מהיום הראשון. הסיבה: מניעת לולאה היא מבנית ולא `if` — היציאה ליומן מופעלת
// אך ורק על ידי כתיבה עם `updatedBy === 'user'`, ולכן כתיבה שמקורה בסנכרון
// נכנס **פיזית לא יכולה** להפעיל דחיפה חוזרת. תנאי כזה אפשר לקיים רק אם השדה
// קיים מהרגע שהמשימה נוצרת; להוסיף אותו אחר כך פירושו מסד נתונים שחציו בלי
// `updatedBy` וכל בדיקה עליו היא ניחוש.
// ============================================================================

import type { TenantScoped, Timestamped } from '../../shared/types/tenant';

export type TaskStatus = 'open' | 'done';

/**
 * מי כתב אחרון. זהו **שדה בקרה, לא מטא-דאטה** — עליו נשענת מניעת הלולאה.
 * `agent` נכנס רק דרך אישור המשתמשת (הסוכן עצמו כותב ל-`proposals`).
 */
export type UpdatedBy = 'user' | 'agent' | 'calendar';

interface TaskFields extends Timestamped {
  id: string;
  title: string;
  notes: string;
  status: TaskStatus;

  /**
   * ISO datetime מקומי (`YYYY-MM-DDTHH:mm`) או null.
   * **משימה בלי זמן לא נכנסת ליומן** — היקף מוגדר, 1:1 בין משימה עם זמן
   * לאירוע. משך בדקות נשמר בנפרד כדי לא להמציא DTEND.
   */
  scheduledAt: string | null;
  durationMinutes: number;

  /** מזהה פריט הטריאז' שממנו נולדה המשימה, אם נולדה ממייל. */
  sourceItemId: string | null;

  // --- שדות סנכרון (רדומים בפרוסה 0, נכתבים נכון כבר עכשיו) ---
  /** מונה גרסה. עולה בכל שינוי תוכן. */
  rev: number;
  updatedBy: UpdatedBy;
  calendarEventId: string | null;
  calendarEtag: string | null;
  /** ה-`rev` האחרון שנדחף ליומן. שווה ל-`rev` ⇒ אין מה לדחוף. */
  lastPushedRev: number | null;
  lastPulledUpdated: string | null;
}

export type Task = TenantScoped<TaskFields>;
