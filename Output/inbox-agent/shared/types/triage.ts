// ============================================================================
// triage.ts — מטא-נתונים של הודעה, פסק הדין של המסנן, ופריט הטריאז' הנשמר.
//
// עקרון-על שמכתיב את הקובץ הזה (תוכנית, "עקרון-על"): התיבה מכילה PII של צד
// שלישי שלא הסכים לכלום — הלקוחות של המשתמשת. לכן `TriageItem` מחזיק
// **מצביעים ונגזרות בלבד**: אין `body`, אין `snippet`, אין `To`/`Cc`, אין
// קבצים מצורפים. הגוף נשלף חי לתצוגה ומת עם הבקשה.
// ============================================================================

import type { Expirable, TenantScoped, Timestamped } from './tenant';

// ---------------------------------------------------------------------------
// קלט: מטא-נתוני הודעה כפי שהם חוזרים מ-`messages.get(format:'metadata')`.
// `format:'metadata'` לא מוריד גוף בכלל — הרעש לא עולה כסף ולא נוגע בשרתים
// שלנו. בפרוסה 0 אותו מבנה בדיוק מגיע מ-fixtures מקומיים.
// ---------------------------------------------------------------------------

export interface MessageMeta {
  messageId: string;
  threadId: string;
  /** כתובת השולח בלבד (בלי שם התצוגה). מנורמלת ב-`normalizeAddress`. */
  fromAddress: string;
  /** שם התצוגה של השולח, אם היה. מוצג — לא משמש לסינון (קל לזייף). */
  fromName?: string;
  subject: string;
  /** ISO 8601. */
  receivedAt: string;

  // כותרות RFC שמסגירות דיוור המוני. כולן אופציונליות — היעדרן הוא מידע.
  replyTo?: string | null;
  listUnsubscribe?: string | null;
  /** `bulk` / `list` / `junk` — RFC 2076. */
  precedence?: string | null;
  /** `auto-generated` / `auto-replied` — RFC 3834. */
  autoSubmitted?: string | null;
}

// ---------------------------------------------------------------------------
// פסק דין
// ---------------------------------------------------------------------------

/**
 * שלוש רמות, בהתאמה למסך דוח הבוקר: 🔴 / 🟡 / ⚪.
 * `unknown` הוא לא "כשלון סיווג" אלא הכרעה לגיטימית — הוא מה שנשלח ל-LLM.
 *
 * ★★ `order` הוא מסלול שלישי מלא, לא תת-סוג של `signal`.
 *
 * ---------------------------------------------------------------------------
 * למה ערך בפונקציה הטהורה, ולא כוונה טובה
 * ---------------------------------------------------------------------------
 * ההחלטה היא ש**הזמנה לא נשלחת למודל. אף פעם.** בגוף הודעת הסליקה יש כתובת
 * המגורים של הלקוחה, שם וטלפון, והיא לא הסכימה לכלום — בוודאי לא להעברת
 * הפרטים שלה לצד שלישי בארה״ב.
 *
 * הצינור, כפי שהיה בנוי, **לא אכף את זה בשום מקום**: הודעת סליקה שלא נקבעה
 * `noise` נופלת לשלב 2 וממנו למודל, בדיוק כמו כל מייל אחר, ובלי שאף אחד
 * יראה. ההגנה היחידה הייתה שהתכוונו אחרת.
 *
 * זו **אותה צורת כשל** בדיוק כמו כלל 1 של הארכוב: החלטה שנשמעת מובנת מאליה,
 * ואין שורת קוד שמסרבת. לכן `order` הוא ערך מלא ב-enum, `needsLlm` שלו הוא
 * `false` **מהגדרת הטיפוס ולא מהתנהגות הקורא**, ויש מבחן שמוכיח שפריט
 * `order` אינו מייצר קריאת מודל.
 *
 * ההבחנה מ-`signal` מהותית ולא סגנונית: `signal` פירושו "חשוב, תעבירו הלאה
 * לניתוח"; `order` פירושו "חשוב, **ואסור** להעביר הלאה".
 */
export type Verdict = 'signal' | 'unknown' | 'noise' | 'order';

/**
 * הסיבה לפסק הדין. נשמרת כי בלעדיה אי אפשר לענות למשתמשת "למה זה נחת ברעש",
 * וזו השאלה הראשונה שהיא תשאל כשמשהו יפול לקבוצה הלא נכונה.
 */
export type TriageReason =
  | 'userRule' // הוראת משתמש מפורשת
  | 'threadSignal' // השרשור כבר סומן סיגנל
  | 'correspondent' // התכתבנו עם הכתובת ב-90 יום
  | 'neverAutoNoise' // דומיין כלי-שיתוף — אסור לסמן רעש אוטומטית
  | 'bulkHeaders' // List-Unsubscribe / Precedence / Auto-Submitted
  | 'senderLedger' // פנקס השולחים האוטומטי
  | 'noreplyAddress' // noreply@ וחבריו
  | 'keywordPromoted' // מילת מפתח קידמה noise -> unknown
  | 'invoiceEvidence' // ★ ספק שכבר שלח חשבוניות — קידם noise -> unknown
  | 'orderMessage' // ★★ הודעת הזמנה ממערכת הסליקה — מסלול שלא עובר במודל
  | 'default'; // לא נמצאה שום אינדיקציה

export interface TriageDecision {
  verdict: Verdict;
  reason: TriageReason;
  /** הסבר קריא לעברית, לתצוגה ליד הפריט. */
  reasonHe: string;
  /**
   * האם הפריט ממשיך לשלב ה-LLM. `false` פירושו אפס טוקנים.
   *
   * ★★ שני פסקים שונים לחלוטין מייצרים כאן `false`, ומאותה שורת קוד:
   * `noise` (**חיסכון** — אין טעם) ו-`order` (**איסור** — אסור). המשמעות
   * הפוכה והתוצאה זהה, בכוונה: הקוד שמחליט אם לקרוא למודל בודק **שדה אחד**,
   * ולא רשימת ערכים שמישהו ישכח להרחיב כשייווסף מסלול רביעי.
   */
  needsLlm: boolean;
  /** מפתח הדומיין שהותאם בפנקס, אם היה. לדיבוג ולתצוגה. */
  matchedDomainKey?: string;
}

// ---------------------------------------------------------------------------
// פלט המודל — הסכימה שהמודל האמיתי יחזיר בפרוסה 1
// ---------------------------------------------------------------------------

export type Category =
  | 'clientInquiry' // פנייה של לקוח
  | 'accounting' // רו"ח / מיסים / חשבוניות
  | 'scheduling' // תיאום פגישה
  | 'sharingTool' // התראת כלי שיתוף (Drive/Dropbox/Calendly)
  | 'marketing' // דיוור שיווקי
  | 'admin' // תפעול, ספקים, שירות
  | 'other';

export type Urgency = 'high' | 'medium' | 'low';

/**
 * הפלט המובנה של קריאת ה-LLM. שדות הבטיחות אינם תוספת — הם מה שמאפשר להוריד
 * את המאגר מרמת אבטחה בינונית ולנטרל פעולות מסוכנות בממשק.
 */
export interface AgentOutput {
  category: Category;
  urgency: Urgency;
  /** עד 200 תווים. נדרס לחלוטין כש-`containsSensitive` דלוק. */
  summaryHe: string;
  actionRequired: boolean;
  suggestedTaskTitle: string | null;
  /** ISO date (YYYY-MM-DD) או null. */
  suggestedDueDate: string | null;

  /**
   * מידע רפואי / פיננסי / משפטי בגוף המייל.
   * כשהוא `true` — הצד שכותב **דורס** את הסיכום ל"פנייה בנושא רגיש", לפני
   * הכתיבה. עולה כלום, ומוריד את המאגר מרמת אבטחה בינונית (דגל M1 של עדי).
   */
  containsSensitive: boolean;
  /** אזכור תשלום/העברה/פרטי בנק → כפתורי פעולה מהירה מושבתים. */
  mentionsPayment: boolean;
  /** בקשת סיסמה/קוד/הזדהות → כפתורי פעולה מהירה מושבתים. */
  requestsCredentials: boolean;
  /** ניסיון הזרקת פקודות או פלט חשוד → תג אדום, אדם מכריע. */
  needsHumanReview: boolean;
}

// ---------------------------------------------------------------------------
// ★ הישות הנשמרת — union מובחן, ולא שדות אופציונליים
// ---------------------------------------------------------------------------
//
// זו הצורה שקבעה סקירת עדי, והיא נבחרה **בגלל** ההבדל מהחלופה.
//
// החור שנמצא: תכננו ש-`containsSensitive` ידרוס את `summaryHe`, אבל `subject`
// נשמר גולמי. כותרת מייל היא בדיוק המקום שבו מידע רגיש מנוסח במפורש
// ("תוצאות בדיקות", "זימון לדיון"), והיא יושבת לצד `fromAddress` שמזהה מי
// האדם. כלומר ההגנה שתכננו הגנה על השדה **הפחות** חשוף מהשניים.
//
// שני תיקונים, ושניהם מבוטאים כאן בטיפוס ולא רק בקוד:
//
//  1. הדריסה מכסה **גם את `subject` וגם את `summaryHe`** — ראה
//     `shared/lib/redactSensitive.ts`.
//
//  2. פריט רעש **לא נושא כותרת ולא כתובת שולח מלאה.** זה הטיעון המשפטי החזק
//     ביותר שיהיה לנו, והוא עולה אפס: ~90% מהכותרות בתיבה פשוט לא נכתבות
//     לעולם, לשום מקום. `fromDomain` כן נשמר — הוא מזין את פנקס השולחים,
//     **ודומיין אינו אדם**.
//
// למה union ולא `subject?: string`: שדה אופציונלי מרשה לכתוב אותו. `never`
// על ענף הרעש הופך "אסור לשמור כותרת לפריט רעש" מהערה בתיעוד לשגיאת
// קומפילציה — כולל בעוד חצי שנה, אצל מי שלא קרא את הסקירה.
//
// מיפוי שמות לשפת הסקירה של עדי: `id` = `gmailMessageId` · `threadId` =
// `gmailThreadId` · `receivedAt` = `internalDate` · `reason` = `verdictSource`.

interface TriageItemBase extends Timestamped, Expirable {
  /** `users/{uid}/items/{gmailMessageId}` — המזהה הוא מזהה ההודעה. */
  id: string;
  threadId: string;
  receivedAt: string;

  /**
   * הדומיין המלא של השולח, מנורמל. נשמר **בכל** פריט, כולל רעש: הוא הקלט
   * של פנקס השולחים, ובלעדיו המסנן לא לומד. דומיין אינו אדם.
   */
  fromDomain: string;

  reason: TriageReason;
  /**
   * הסבר קריא. מנוסח בכוונה כך שלא יכיל כתובת או כותרת — ראה
   * `triageFilter.ts`; אחרת הוא היה דלת אחורית לאותו PII שהמבנה כאן מונע.
   */
  reasonHe: string;
}

/**
 * פריט שנחסם בשלב 1. **לא רץ עליו מודל ולא נשמר עליו תוכן.**
 * שדות ה-`never` הם האכיפה עצמה, לא תיעוד.
 */
interface NoiseItemFields extends TriageItemBase {
  verdict: 'noise';

  subject?: never;
  fromAddress?: never;
  fromName?: never;
  agent?: never;
  modelId?: never;
  handled?: never;
}

/** פריט שעבר את הסינון ונשלח למודל. רק כאן קיימים שדות מזהים. */
interface ClassifiedItemFields extends TriageItemBase {
  verdict: 'signal' | 'unknown';

  fromAddress: string;
  fromName: string;

  /**
   * הנושא נשמר — בלעדיו כל רינדור רשימה דורש עשרות קריאות Gmail. ובכל זאת
   * הוא PII של צד שלישי, ולכן שלוש מגבלות: הוא קיים **רק** בענף הזה
   * (~90% מהתיבה לא מגיעה לכאן), retention 90 יום דרך `purgeAfter`, ודריסה
   * מלאה כש-`containsSensitive`. זו התשובה, מילה במילה, לשאלה "למה `subject`
   * כן ו-`snippet` לא".
   */
  subject: string;

  /** `null` רק אם קריאת המודל נכשלה. */
  agent: AgentOutput | null;
  /** מזהה המודל ששימש, או `mock:v1` בפרוסה 0. לביקורת. */
  modelId: string;
  /** סומן כטופל על ידי המשתמשת. */
  handled: boolean;
}

/**
 * ★★ פריט הזמנה. **לא רץ עליו מודל, ואין לו `agent`.**
 *
 * שדה ה-`agent` מסומן `never` בדיוק מאותה סיבה ש-`subject` מסומן `never`
 * בפריט רעש: כדי שהמשפט "הזמנה לא נשלחת למודל" יהיה **שגיאת קומפילציה**
 * כשמישהו ינסה לסתור אותו, ולא הערה בתיעוד שנשחקת בסבב השלישי.
 *
 * ★ מה שמעניין כאן: הפריט הזה **נקי מ-PII לחלוטין**. הכותרת היא מחרוזת
 * קבועה שנוצרה במכונה, וכתובת השולח היא מערכת סליקה ולא אדם. כל מה ששייך
 * ללקוחה — שם, טלפון, כתובת — חי ב-`Order` בלבד, שיש לו מדיניות מחיקה משלו.
 * ההפרדה הזאת היא מה שמאפשר למחוק את הכתובת בלי לאבד את העקבה שההזמנה
 * הגיעה.
 */
interface OrderItemFields extends TriageItemBase {
  verdict: 'order';

  /** מערכת הסליקה. לא אדם. */
  fromAddress: string;
  fromName: string;
  /** הנושא הקבוע של הודעת העסקה — מחרוזת מהמכונה, לא טקסט שאדם כתב. */
  subject: string;

  /** מזהה ה-`Order` שנוצר מההודעה, אם נוצר. */
  orderId: string | null;
  /** הפענוח נכשל או שנמצאה בעיה — המסך יציג הסבר במקום כתובת. */
  needsHumanReview: boolean;

  agent?: never;
  modelId?: never;
  handled?: never;
}

export type NoiseItem = TenantScoped<NoiseItemFields>;
export type ClassifiedItem = TenantScoped<ClassifiedItemFields>;
export type OrderTriageItem = TenantScoped<OrderItemFields>;
export type TriageItem = NoiseItem | ClassifiedItem | OrderTriageItem;

/**
 * צמצום הטיפוס. כל קוד שנוגע ב-`agent` חייב לעבור דרך כאן.
 *
 * ★ שים לב שזו **בדיקה חיובית** ולא `!== 'noise'`. הניסוח השלילי היה מכניס
 * את פריטי ההזמנה לענף המסווג ברגע שנוסף המסלול השלישי — כלומר תופס אותם
 * ככאלה שרץ עליהם מודל. זו בדיוק הצורה שבה union מובחן נשבר בשקט כשמוסיפים
 * לו ערך.
 */
export function isClassified(item: TriageItem): item is ClassifiedItem {
  return item.verdict === 'signal' || item.verdict === 'unknown';
}

export function isOrderItem(item: TriageItem): item is OrderTriageItem {
  return item.verdict === 'order';
}

/**
 * הרמה שבה הפריט מוצג בדוח הבוקר.
 * `order` אינו רמה בדוח — הוא שולח את הפריט למסך אחר לגמרי.
 */
export type BriefLevel = 'action' | 'review' | 'noise' | 'order';

/** ספירות ריצה — המקבילה המקומית של `agentRuns/{runId}`. */
export interface RunStats {
  fetched: number;
  filteredOut: number;
  llmCalls: number;
  /** `filteredOut / fetched`. היעד בתוכנית: מעל 0.85. */
  filterRate: number;
  /** אומדן חיסכון בדולרים לעומת שליחת הכול למודל. */
  estSavedUsd: number;
}
