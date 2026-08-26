// ============================================================================
// FriendlyError.tsx — ★ מצב תקלה, מנוסח כמו שאדם היה מסביר אותו.
//
// ---------------------------------------------------------------------------
// שלושת הכללים, וכולם נובעים מאותה נקודה
// ---------------------------------------------------------------------------
// המשתמשת היחידה שלנו לא מבינה במחשוב. הודעת שגיאה טכנית לא רק חסרת תועלת
// עבורה — היא **מפחידה**, ותחושת "שברתי משהו" היא מה שגורם לאדם להפסיק
// להשתמש בכלי. לכן:
//
//  1. **מה קרה** — במשפט אחד, בגוף ראשון, בלי קוד שגיאה ובלי אנגלית.
//  2. **מה לעשות עכשיו** — פעולה אחת קונקרטית.
//  3. **וכשאין מה לעשות** — "רונן צריך להסתכל על זה". זה מצב לגיטימי ותשובה
//     טובה: הוא מסיר ממנה את האחריות במקום להשאיר אותה תקועה מול הודעה
//     שהיא לא יכולה לפעול לפיה.
//
// ---------------------------------------------------------------------------
// `details` — ולמה הוא לא על המסך
// ---------------------------------------------------------------------------
// הפרטים הטכניים כן נשמרים, אבל ל-`console` בלבד: הם צריכים להיות זמינים
// למי שיתקן, ולא למי שמשתמשת. הצגתם "בשביל שיהיה" היא בדיוק הדבר שהופך מסך
// תקלה למסך מפחיד.
// ============================================================================

import { useEffect } from 'react';

export interface FriendlyErrorProps {
  /** מה קרה, במילים שלה. */
  whatHappened: string;
  /**
   * מה לעשות עכשיו. אם `null` — מוצג "רונן צריך להסתכל על זה",
   * וזו תשובה טובה ולא כישלון.
   */
  whatToDo?: string | null;
  /** פרטים למי שיתקן. לא מוצגים — נכתבים ל-`console`. */
  details?: unknown;
  /** פעולה שאפשר לנסות שוב, אם יש כזו. */
  onRetry?: () => void;
}

export function FriendlyError({ whatHappened, whatToDo, details, onRetry }: FriendlyErrorProps) {
  useEffect(() => {
    if (details !== undefined) {
      // eslint-disable-next-line no-console
      console.error('[inbox-agent]', whatHappened, details);
    }
  }, [whatHappened, details]);

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm" role="alert">
      <p className="font-semibold text-amber-900">{whatHappened}</p>
      <p className="mt-1 leading-relaxed text-amber-900">
        {whatToDo ?? 'אין כאן משהו שאת צריכה לעשות — רונן צריך להסתכל על זה.'}
      </p>

      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-[44px] rounded-lg border border-amber-500 bg-white px-4 py-2 text-sm font-medium text-amber-900 hover:bg-amber-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-700"
        >
          לנסות שוב
        </button>
      ) : null}
    </div>
  );
}
