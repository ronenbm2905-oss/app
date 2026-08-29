// ============================================================================
// supportMode.ts — ★★ B3′. "מצב תמיכה": הגבול בין רונן לתיבה של דורית.
//
// ---------------------------------------------------------------------------
// למה המנגנון הזה, ולמה דווקא הוא ולא אישור פר-פנייה
// ---------------------------------------------------------------------------
// הסקירה תכננה תחילה grant פר-פנייה, עם `reason`, `scope` ופקיעה ב-72 שעות,
// ואז **ביטלה את זה בעצמה** — וההנמקה היא הדבר החשוב כאן:
//
// > *"אישור פר-פנייה … הוא overhead שלא ישרוד את המפגש עם המציאות של אדם
// > שמתקן באג בשעה 23:00. **מנגנון שעוקפים הוא גרוע ממנגנון פשוט יותר
// > שמקיימים.**"*
//
// ולכן: **מתג אחד שדורית מדליקה, שפג מעצמו בסוף היום, שמופיע כבאנר, וכל
// פתיחה תחתיו נרשמת ומוצגת לה.** אותה מהות — הסכמה אקטיבית, מוגבלת, גלויה
// ומתועדת — בלי לדרוש ממנה להבין מה זה `scope`.
//
// ---------------------------------------------------------------------------
// ★★ שלוש הכרעות שהן ההבדל בין המנגנון הזה לבין תיאטרון
// ---------------------------------------------------------------------------
//  1. **רונן לא יכול להדליק את המתג.** לא בממשק ולא ב-Admin SDK — הכתיבה
//     לשדה עוברת דרך `onCall` שדורש `request.auth.uid === ownerUid`. אם
//     המחזיק יכול להדליק לעצמו את ההיתר, ההיתר אינו הסכמה אלא טופס.
//     ⚠️ ומה שזה **לא** עושה: רונן מחזיק את פרויקט Firebase, ולכן הוא יכול
//     לכתוב לכל מסמך דרך הקונסולה. המתג אינו מונע ממנו — הוא **מתעד**.
//     בדיוק כמו שכתוב לה במסמך: *"אין הגדרה שאפשר להדליק שתמנע ממנו את זה."*
//
//  2. **פקיעה בסוף היום, לא אחרי X שעות.** "72 שעות" מייצר מצב שבו המתג
//     דלוק ואיש לא זוכר מתי הוא נכבה. "עד סוף היום" הוא דבר שאדם יודע
//     לחשוב עליו בלי להסתכל. הפקיעה מחושבת **בשעון ישראל** ולא UTC —
//     ב-UTC "סוף היום" נופל ב-03:00 בלילה שלה, וזה בדיוק סוג הפער שגורם
//     למתג להיות דלוק בזמן שהמסך אומר שהוא כבוי.
//
//  3. **הרישום נכתב לפני הקריאה, לא אחרי.** ראה `accessLog.ts` בצד
//     ה-Functions: אם הכתיבה ליומן נכשלת — **הקריאה לא מתבצעת.** תיעוד
//     שנכתב אחרי הפעולה הוא תיעוד שנעדר בדיוק כשהפעולה נכשלה באמצע.
//
// ---------------------------------------------------------------------------
// ★ M15 — הרשומה מובנית, לא מחרוזת
// ---------------------------------------------------------------------------
// המסך מציג עברית, אבל **מה שנשמר הוא שדות**: `at`, `actor`, `action`,
// `targetKind`, `targetCount`. הסיבה כתובה בסקירה: זה הפריט היחיד שקשה
// לרטרו-פיט אם ייחצה סף ה-10,000 — תיעוד גישה שלא נאסף אי אפשר לאסוף
// בדיעבד. הניסוח העברי נגזר מהשדות (`describeAccessEntryHe`), ולא להפך.
// ============================================================================

/** אזור הזמן שבו "סוף היום" מוגדר. השעון שלה, לא השעון של השרת. */
export const SUPPORT_MODE_TIMEZONE = 'Asia/Jerusalem';

/** מה נרשם ביומן. רשימה סגורה — ערך חדש דורש לגעת בקובץ הזה. */
export type AccessAction =
  /** דורית הדליקה את המתג. */
  | 'supportModeEnabled'
  /** דורית כיבתה אותו ידנית. */
  | 'supportModeDisabled'
  /** המתג פג מעצמו בסוף היום. */
  | 'supportModeExpired'
  /** ★ רונן פתח תוכן של הזמנה. **זו הרשומה שכל המנגנון קיים בשבילה.** */
  | 'orderContentOpened'
  /** ★ ניסיון גישה שנחסם כי המתג היה כבוי. נרשם גם הוא — ודווקא הוא. */
  | 'accessDenied';

export type AccessActor = 'owner' | 'holder';

/**
 * רשומת יומן אחת.
 *
 * ⚠️ **אין כאן שדה תוכן, ולא יהיה.** לא `subject`, לא כתובת, לא שם לקוחה,
 * ולא "מה נפתח" מעבר למזהה של גוגל ולספירה. יומן גישה שמעתיק את מה שנצפה
 * הוא עותק שני של אותו מידע, בדיוק במקום שהכי פחות מנוהל.
 */
export interface AccessLogEntry {
  id: string;
  /** ISO. */
  at: string;
  actor: AccessActor;
  action: AccessAction;
  /** על מה — `order` / `supportMode`. לא **איזה**. */
  targetKind: 'order' | 'supportMode' | 'none';
  /** כמה פריטים נגעו. `1` ברוב המקרים. */
  targetCount: number;
  /**
   * ★ מזהה ההודעה אצל גוגל, כשרלוונטי. מזהה ולא תוכן — והוא מה שמאפשר לה
   * לפתוח את אותו מייל ולראות בעצמה על מה מדובר.
   */
  sourceMessageId: string | null;
}

// ---------------------------------------------------------------------------
// ★ פקיעה בסוף היום — בשעון ישראל
// ---------------------------------------------------------------------------

const partsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: SUPPORT_MODE_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** אותו רגע, כפי שהוא נראה בשעון ישראל, כאילו הוא UTC. */
function asJerusalemWallClock(d: Date): Date {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(d).map((p) => [p.type, p.value]),
  ) as Record<string, string>;
  return new Date(
    `${parts.year}-${parts.month}-${parts.day}T${parts.hour === '24' ? '00' : parts.hour}:${parts.minute}:${parts.second}Z`,
  );
}

/**
 * ★★ הרגע שבו המתג נכבה: **חצות הקרובה בשעון ישראל.**
 *
 * החישוב עובר דרך ההפרש בין שעון הקיר לבין UTC באותו רגע, ולא דרך היסט
 * קבוע: ישראל עוברת בין +02:00 ל-+03:00, והיסט מקובע היה גורם למתג להישאר
 * דלוק שעה נוספת חצי שנה בשנה.
 *
 * ⚠️ מגבלה מודעת: בלילה שבו השעון מוזז, החישוב יכול לסטות בשעה. הוא לא
 * מייצר "לא פג לעולם" — הוא מייצר "פג בשעה שגויה בלילה אחד בשנה", וזה מחיר
 * סביר מול הסיבוך של חישוב מלא.
 */
export function supportModeExpiryFor(now: Date | string = new Date()): string {
  const at = now instanceof Date ? now : new Date(now);
  const wall = asJerusalemWallClock(at);
  const offsetMs = wall.getTime() - at.getTime();

  const nextMidnightWall = Date.UTC(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate() + 1,
    0,
    0,
    0,
    0,
  );
  return new Date(nextMidnightWall - offsetMs).toISOString();
}

/** מצב המתג כפי שהוא נשמר. `null` = מעולם לא הודלק. */
export interface SupportModeState {
  enabled: boolean;
  /** ISO — מתי הוא נכבה מעצמו. */
  expiresAt: string | null;
  /** ISO — מתי הודלק. מוצג לה. */
  enabledAt: string | null;
}

export const SUPPORT_MODE_OFF: SupportModeState = {
  enabled: false,
  expiresAt: null,
  enabledAt: null,
};

/**
 * ★★ האם הגישה פתוחה **עכשיו**.
 *
 * `enabled === true` לבדו אינו מספיק, ובכוונה: הפקיעה חייבת להיאכף בכל
 * קריאה ולא להסתמך על תהליך שיכבה את הדגל. תהליך כזה יכול לא לרוץ — וזו
 * בדיוק צורת הכשל של `purgeAfter` ב-hachzarei-mas: שדה שנכתב ואיש לא קרא.
 *
 * הפונקציה הזאת היא ה"קורא".
 */
export function isSupportModeActive(
  state: SupportModeState | null | undefined,
  now: Date | string = new Date(),
): boolean {
  if (!state || state.enabled !== true) return false;
  if (typeof state.expiresAt !== 'string' || state.expiresAt.length === 0) return false;
  const expiry = new Date(state.expiresAt).getTime();
  if (!Number.isFinite(expiry)) return false;
  const at = (now instanceof Date ? now : new Date(now)).getTime();
  return at < expiry;
}

/** מדליקה. הפקיעה נקבעת כאן ולא בקליינט — שעון של דפדפן אינו מדיניות. */
export function enableSupportMode(now: Date | string = new Date()): SupportModeState {
  const at = (now instanceof Date ? now : new Date(now)).toISOString();
  return { enabled: true, enabledAt: at, expiresAt: supportModeExpiryFor(at) };
}

// ---------------------------------------------------------------------------
// ★ הניסוח שהיא רואה
// ---------------------------------------------------------------------------

const whenFormatter = new Intl.DateTimeFormat('he-IL', {
  timeZone: SUPPORT_MODE_TIMEZONE,
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

export function formatAccessWhen(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : whenFormatter.format(d);
}

/**
 * ★★ הרשומה, במשפט אחד בעברית.
 *
 * מהסקירה: *"תיעוד שנושא המידע לא יכול לקרוא אינו תיעוד עבורו."* Cloud Audit
 * Logs בקונסולה שרק רונן נכנס אליה אינם מקיימים את B3′.2 — לא בגלל שהם לא
 * מדויקים, אלא בגלל שהיא לא יכולה להסתכל בהם.
 *
 * הניסוח נגזר מהשדות, כדי שרשומה שנכתבה ולא נוסחה תופיע כ"פעולה שלא זיהיתי"
 * ולא תיעלם מהרשימה. שורה שאין לה טקסט היא בדיוק השורה שכדאי לראות.
 */
export function describeAccessEntryHe(entry: AccessLogEntry): string {
  const when = formatAccessWhen(entry.at);
  const who = entry.actor === 'owner' ? 'את' : 'רונן';

  switch (entry.action) {
    case 'supportModeEnabled':
      return `ב-${when} ${who} הדלקת את מצב התמיכה. הוא נכבה לבד בסוף היום.`;
    case 'supportModeDisabled':
      return `ב-${when} ${who} כיבית את מצב התמיכה.`;
    case 'supportModeExpired':
      return `ב-${when} מצב התמיכה נכבה מעצמו בסוף היום.`;
    case 'orderContentOpened':
      return entry.targetCount === 1
        ? `ב-${when} ${who} פתח הזמנה אחת כדי לבדוק תקלה.`
        : `ב-${when} ${who} פתח ${entry.targetCount} הזמנות כדי לבדוק תקלה.`;
    case 'accessDenied':
      return `ב-${when} ${who} ניסה לפתוח הזמנה ולא היה יכול — מצב התמיכה היה כבוי.`;
    default:
      return `ב-${when} נרשמה פעולה שלא זיהיתי. כדאי לשאול את רונן מה זה.`;
  }
}

/** הבאנר שמופיע כל עוד המתג דלוק. גלוי, ולא ניתן לסגירה. */
export const SUPPORT_MODE_BANNER_HE =
  'מצב תמיכה דלוק — רונן יכול לפתוח הזמנות כדי לבדוק תקלה. זה נכבה לבד בסוף היום, וכל פתיחה נרשמת ומופיעה כאן למטה.';
