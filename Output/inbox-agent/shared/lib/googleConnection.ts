// ============================================================================
// googleConnection.ts — מצב החיבור לגוגל, ו-`invalid_grant` בפרט.
//
// ---------------------------------------------------------------------------
// למה `invalid_grant` מקבל טיפול משלו ולא נבלע ב"שגיאה"
// ---------------------------------------------------------------------------
// כי הוא **המצב היחיד שמצריך פעולה מדורית**, ובכל שאר המצבים אין לה מה
// לעשות. אם נטפל בו כמו בכל שגיאה, המסך יגיד לה "לא הצלחתי לקרוא הזמנות
// הבוקר" — והיא תחכה שזה יסתדר, כי זה מה שאומרים לה. זה לא יסתדר לעולם:
// refresh token שנפסל לא חוזר לחיים.
//
// ומתי הוא קורה בפועל, וזה לא נדיר:
//  · מסך ההסכמה במצב **Testing** — Google פוסלת את הטוקן אחרי **7 ימים**.
//  · דורית ביטלה את הגישה במסך ההרשאות של חשבון Google.
//  · היא החליפה סיסמה, או שגוגל זיהתה אירוע אבטחה.
//  · הטוקן הוחלף בהרשאה חדשה (Google מנפיקה אחד בכל פעם לכל client).
//
// ---------------------------------------------------------------------------
// ★★ והמשפט שבאנר חייב לומר — *"שום דבר לא נמחק"*
// ---------------------------------------------------------------------------
// זה לא ריכוך. זו העובדה המרכזית, והיא לא מובנת מאליה למי שלא יודעת איך זה
// עובד: כשמשהו "פג", ההנחה הסבירה של אדם היא שמה שהיה שם הלך. ובלי המשפט
// הזה, ההתנהגות ההגיונית שלה היא **להעתיק את כל ההזמנות לפנקס לפני שתלחץ**
// — כלומר לייצר עותק שלישי של אותן כתובות, מחוץ לכל מדיניות מחיקה.
//
// ומבחינת הקוד זה נכון: חיבור מחדש דורס את `oauthTokens/{uid}` **בלבד**.
// `orders` אינו נגזר ממנו ואינו נמחק איתו — ראה `tokenStore.replaceTokens`,
// שכותב מסמך אחד ואינו נוגע בשום אוסף אחר.
// ============================================================================

/**
 * מצב החיבור, כפי שהוא נשמר ב-`users/{uid}` ומוצג במסך.
 *
 * ★ `expired` ו-`error` הם שני מצבים נפרדים, וזו כל הנקודה של הקובץ:
 * `expired` = היא צריכה ללחוץ · `error` = היא לא צריכה לעשות כלום.
 * מיזוגם למצב אחד הופך את אחד משניהם להודעה שגויה.
 */
export type GoogleConnectionState =
  /** מעולם לא חובר. */
  | 'disconnected'
  /** מחובר ועובד. */
  | 'connected'
  /** ★★ הטוקן נפסל. **דורש לחיצה שלה.** */
  | 'expired'
  /** תקלה זמנית — רשת, מכסה, שגיאת שרת. אין מה לעשות. */
  | 'error';

/**
 * ★★ הקוד שגוגל מחזירה כשה-refresh token אינו קביל.
 *
 * הקבוע קיים כדי שהבדיקה תהיה על **מחרוזת אחת מוגדרת** ולא על `includes`
 * גס: `error.message.includes('invalid')` היה תופס גם `invalid_client`
 * (שהוא תקלת קונפיג של רונן) וגם `invalid_scope`, ושולח את דורית להתחבר
 * מחדש שוב ושוב על תקלה שהחיבור מחדש לא פותר.
 */
export const INVALID_GRANT = 'invalid_grant';

/**
 * ★ מזהה **רק** `invalid_grant`, ובדיקה מדויקת.
 *
 * הפונקציה מקבלת `unknown` כי מה שנתפס ב-`catch` הוא `unknown`, ובכל
 * ספרייה זה נראה אחרת: `googleapis` שם את הקוד ב-`err.response.data.error`,
 * וב-`google-auth-library` הוא לפעמים ב-`err.message`. שלושת המקומות
 * נבדקים כאן, במקום אחד, כדי שלא תהיה שלישייה של `if`-ים מפוזרים שמתיישנים
 * בנפרד.
 */
export function isInvalidGrant(err: unknown): boolean {
  if (err === null || typeof err !== 'object') return false;
  const e = err as {
    message?: unknown;
    response?: { data?: { error?: unknown } };
    error?: unknown;
  };

  if (typeof e.error === 'string' && e.error === INVALID_GRANT) return true;
  const nested = e.response?.data?.error;
  if (typeof nested === 'string' && nested === INVALID_GRANT) return true;
  if (typeof e.message === 'string') {
    // ההודעה מגיעה בצורה `invalid_grant` או `invalid_grant: Token has been expired`.
    // גבול מילה משני הצדדים, כדי ש-`invalid_grant_type` לא ייתפס.
    return new RegExp(`(^|[^a-z_])${INVALID_GRANT}([^a-z_]|$)`).test(e.message);
  }
  return false;
}

/** המצב שאליו עוברים אחרי שגיאה. `invalid_grant` בלבד מוביל ל-`expired`. */
export function connectionStateAfterError(err: unknown): GoogleConnectionState {
  return isInvalidGrant(err) ? 'expired' : 'error';
}

/**
 * ★★ הבאנר. **הנוסח מכוון ולא ישופר מקומית.**
 *
 * שלושה חלקים, ובסדר הזה: מה קרה · מה לעשות · **מה לא קרה**. החלק השלישי
 * הוא שמונע ממנה להעתיק את כל הרשימה לפנקס לפני שתלחץ.
 */
export const CONNECTION_EXPIRED_HE =
  'החיבור לגוגל פג. לחצי כאן להתחבר מחדש — שום דבר לא נמחק.';

/** ההסבר הקצר שמתחת לבאנר, למי שרוצה לדעת למה. */
export const CONNECTION_EXPIRED_DETAIL_HE =
  'זה קורה מדי פעם מעצמו, וזה לא סימן שמשהו השתבש. ההזמנות שכבר קראתי נשארו כאן בדיוק כפי שהיו — החיבור מחדש רק מחזיר לי את היכולת לקרוא הודעות חדשות.';

export const CONNECTION_ERROR_HE =
  'לא הצלחתי להתחבר לגוגל הבוקר. אין מה לעשות מצדך — אנסה שוב אוטומטית, ואם זה נמשך רונן צריך להסתכל על זה.';

export const CONNECTION_DISCONNECTED_HE =
  'התיבה עדיין לא מחוברת. עד שתחברי אותה, אין מה להציג כאן.';

/** המשפט שמתאים למצב. פונקציה אחת, כדי שהמסך לא יבנה `if` משלו. */
export function connectionMessageHe(state: GoogleConnectionState): string | null {
  switch (state) {
    case 'expired':
      return CONNECTION_EXPIRED_HE;
    case 'error':
      return CONNECTION_ERROR_HE;
    case 'disconnected':
      return CONNECTION_DISCONNECTED_HE;
    case 'connected':
      return null;
    default:
      return null;
  }
}

/** האם המצב דורש פעולה של דורית. רק זה מציג כפתור. */
export function needsUserAction(state: GoogleConnectionState): boolean {
  return state === 'expired' || state === 'disconnected';
}
