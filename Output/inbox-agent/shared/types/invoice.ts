// ============================================================================
// invoice.ts — חשבוניות: הקובץ שנשמר, והטבלה שיוצאת לרו״ח.
//
// ---------------------------------------------------------------------------
// ★ העיקרון שמכתיב כל שדה כאן
// ---------------------------------------------------------------------------
// **מספר שחולץ ולא אומת גרוע ממספר חסר.**
//
// זה לא סלוגן. חשבונית היא מקור למספרים שמגיעים לרו״ח, ומשם לדיווח למס.
// שדה ריק עם הסבר גורם לבעלת העסק לפתוח את המסמך — הפסד של שלושים שניות.
// שדה עם מספר שגוי שנראה סמכותי לא גורם לה לפתוח כלום. לכן כל שדה כאן הוא
// `| null`, ו-`null` הוא **תוצאה לגיטימית של הצלחה חלקית**, לא כישלון.
//
// ---------------------------------------------------------------------------
// גם תיקייה וגם טבלה
// ---------------------------------------------------------------------------
// שני תוצרים לאותו מייל, ובכוונה:
//  1. **הקובץ** — נשמר בנתיב דטרמיניסטי (`shared/lib/invoiceFiling.ts`),
//     כדי שתמיד יהיה מסמך מקור לפתוח.
//  2. **השורה בטבלה** — ספק, סכום, מטבע, תאריך, מספר, מע״מ.
// הטבלה **לעולם לא מחליפה** את הקובץ; היא מצביעה אליו. אם השורה מסופקת,
// המסמך הוא מה שקובע.
//
// ---------------------------------------------------------------------------
// הערה משפטית שצריכה להיאמר כאן ולא רק בשער
// ---------------------------------------------------------------------------
// עד עכשיו המערכת החזיקה **נגזרות** בלבד. חשבונית היא חריג מודע: אנחנו
// מאחסנים מסמך פיננסי של **צד שלישי** (ספק) ואת המספרים שבו. זה מה שהפיצ׳ר
// הוא, ואי אפשר לספק אותו בלי זה — אבל זו הרחבה אמיתית של המאגר, והיא רשומה
// כאן וב-README כדי שהשער המשפטי יראה אותה מנוסחת ולא יגלה אותה.
// ============================================================================

import type { Expirable, TenantScoped, Timestamped } from './tenant';

// ---------------------------------------------------------------------------
// קובץ מצורף — **מטא בלבד**
// ---------------------------------------------------------------------------

/**
 * מה שאנחנו יודעים על קובץ מצורף בלי לפתוח אותו.
 *
 * הערה חשובה על Gmail: `messages.get(format:'metadata')` — הקריאה הזולה שהצינור
 * משתמש בה — **לא מחזירה את רשימת הקבצים המצורפים**. לכן זיהוי לפי שם קובץ
 * זמין רק אחרי משיכה מלאה, שרצה בלבד על מה שכבר עבר את המסנן. זה מדויק ולא
 * מקרי: ל-`invoiceDetect` יש בגלל זה **שתי דרגות ראיה** — כותרות בלבד, וכותרות
 * עם קבצים. ראה שם.
 */
export interface AttachmentMeta {
  attachmentId: string;
  /** שם הקובץ **כפי שהשולח כתב אותו**. טענה של השולח, לא עובדה. */
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}

/** סוגי קבצים שיש טעם לנסות לחלץ מהם. כל השאר מסומן ולא נפתח. */
export const EXTRACTABLE_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
] as const;

export type ExtractableMimeType = (typeof EXTRACTABLE_MIME_TYPES)[number];

export function isExtractableMime(mime: string): boolean {
  return (EXTRACTABLE_MIME_TYPES as readonly string[]).includes(String(mime ?? '').toLowerCase());
}

// ---------------------------------------------------------------------------
// זיהוי דטרמיניסטי — לפני המודל
// ---------------------------------------------------------------------------

/**
 * שלוש דרגות, ולא בוליאני. אותו היגיון בדיוק כמו ב-`triageFilter`:
 * `possible` הוא הכרעה לגיטימית ולא כישלון סיווג — הוא אומר "יש כאן משהו,
 * ואין לי מספיק ראיות דטרמיניסטיות כדי לקבוע לבד".
 */
export type InvoiceVerdict = 'invoice' | 'possible' | 'notInvoice';

/** הסיבה. בלעדיה אי אפשר לענות "למה זה נחשב חשבונית" — השאלה הראשונה. */
export type InvoiceDetectReason =
  | 'userRuleAlways' // הוראת משתמש: מהדומיין הזה תמיד מגיעות חשבוניות
  | 'userRuleNever' // הוראת משתמש: אף פעם לא
  | 'attachmentName' // שם הקובץ עצמו מסגיר חשבונית
  | 'supplierDomain' // ספק מוכר + קובץ מסמך
  | 'subjectAndAttachment' // מילת מפתח בנושא + קובץ מסמך
  | 'attachmentOnly' // קובץ מסמך בלי שום רמז נוסף
  | 'subjectOnly' // מילת מפתח בנושא, בלי קובץ — אין ממה לחלץ
  | 'noEvidence';

export interface InvoiceDetection {
  verdict: InvoiceVerdict;
  reason: InvoiceDetectReason;
  /** משפט בעברית פשוטה. מה שמוצג על המסך, מילה במילה. */
  reasonHe: string;
  /**
   * ★ הקובץ שממנו יחולצו הנתונים. `null` פירושו שאין ממה לחלץ — גם אם
   * הנושא צועק "חשבונית". חילוץ סכום מגוף מייל הוא ניחוש, וניחוש אסור כאן.
   */
  attachment: AttachmentMeta | null;
  /** נגזר: האם יש טעם לשלוח את זה למודל. */
  needsExtraction: boolean;
  matchedSupplierDomain?: string;
  /** מה בדיוק התאים — שם קובץ, מילה בנושא. לתצוגה ולדיבוג. */
  matchedEvidence?: string;
}

// ---------------------------------------------------------------------------
// פלט המודל (פרוסה 1) — לפני ולידציה
// ---------------------------------------------------------------------------

/** enum סגור. מטבע שאינו ברשימה נדחה ואינו מנוחש. */
export const INVOICE_CURRENCIES = ['ILS', 'USD', 'EUR', 'GBP'] as const;
export type InvoiceCurrency = (typeof INVOICE_CURRENCIES)[number];

export const INVOICE_DOCUMENT_KINDS = [
  'invoice', // חשבונית מס
  'receipt', // קבלה
  'invoiceReceipt', // חשבונית מס/קבלה
  'creditNote', // חשבונית זיכוי
  'proforma', // דרישת תשלום / פרופורמה
  'unknown',
] as const;
export type InvoiceDocumentKind = (typeof INVOICE_DOCUMENT_KINDS)[number];

// ---------------------------------------------------------------------------
// ★★ מה שאסור לחלץ — ולמה זה הפוך מהאינטואיציה
// ---------------------------------------------------------------------------
//
// **פרטי תשלום לא מחולצים. בכלל.** לא מספר חשבון, לא IBAN, לא שם בנק, לא
// מספר סניף, לא כרטיס. **גם כשהם כתובים במסמך במפורש.**
//
// האינטואיציה אומרת שזה בדיוק מה שכדאי לחלץ — הרי זה מה שצריך כדי לשלם.
// הנימוק ההפוך חזק ממנה בהרבה:
//
// חשבונית מזויפת שבה **פרטי הבנק הוחלפו** היא תרחיש ההונאה הנפוץ ביותר מול
// עסקים. אותו ספק, אותו לוגו, אותו סכום — חשבון בנק אחר. ההגנה היחידה שעובדת
// מולה היא **החשד של מי שמסתכל**: רגע קטן של "רגע, זה לא החשבון הרגיל שלהם".
//
// טבלה נקייה, מסודרת ואוטומטית שמגיעה לרו״ח **מוחקת בדיוק את הרגע הזה.**
// המספר מופיע בעמודה מסודרת לצד שם הספק, נראה כמו נתון מאומת, ומועבר לתשלום.
// המערכת הופכת למכונת הלבנה — **לא בגלל באג, אלא דווקא בגלל שעשתה את
// עבודתה היטב.** זה סוג הכשל שלא מתגלה בבדיקות, כי כל רכיב בו תקין.
//
// לכן `InvoiceExtraction` מכיל ספק / סכום / מטבע / תאריך / מספר / מע״מ, ותו
// לא. אין שדה לפרטי תשלום, ואי אפשר "להוסיף רק אחד" בלי לגעת בטיפוס הזה
// ובמבחן `tests/invoiceFields.test.ts` שנועל את רשימת השדות.
// ---------------------------------------------------------------------------

/**
 * ★ נעילת רשימת השדות. המבחן משווה מולה את מפתחות `InvoiceFields` בפועל,
 * כך שהוספת שדה חדש מפילה מבחן ומחייבת החלטה מודעת.
 */
export const ALLOWED_INVOICE_FIELDS = [
  'supplierName',
  'supplierTaxId',
  'invoiceNumber',
  'issueDate',
  'currency',
  'subtotal',
  'vatAmount',
  'vatRate',
  'total',
  'documentKind',
] as const;

/**
 * מה שהמודל מחזיר. **כל השדות רופפים בכוונה** — `currency` הוא `string` ולא
 * `InvoiceCurrency`, ו-`issueDate` הוא `string` ולא תאריך תקין.
 *
 * זו לא רשלנות טיפוסים אלא הצהרה: הפלט של המודל אינו נתון מהימן עד
 * ש-`validateInvoice` בדק אותו. אילו היינו מטפסים אותו כ-`InvoiceCurrency`,
 * הקומפיילר היה מבטיח משהו שאף אחד לא אימת, ומי שקורא את הקוד היה מאמין לו.
 */
export interface InvoiceExtraction {
  supplierName: string | null;
  /** מספר עוסק / ח.פ. כפי שהופיע במסמך. */
  supplierTaxId: string | null;
  invoiceNumber: string | null;
  /** `YYYY-MM-DD` — כך התבקש. מה שיגיע בפועל זו שאלה נפרדת. */
  issueDate: string | null;
  currency: string | null;
  subtotal: number | null;
  vatAmount: number | null;
  /** שיעור המע״מ באחוזים (18 ולא 0.18). */
  vatRate: number | null;
  total: number | null;
  documentKind: string;
}

/** חילוץ ריק — מה שמוחזר כשלא הצלחנו לקרוא כלום. */
export const EMPTY_EXTRACTION: InvoiceExtraction = {
  supplierName: null,
  supplierTaxId: null,
  invoiceNumber: null,
  issueDate: null,
  currency: null,
  subtotal: null,
  vatAmount: null,
  vatRate: null,
  total: null,
  documentKind: 'unknown',
};

// ---------------------------------------------------------------------------
// אחרי הוולידציה
// ---------------------------------------------------------------------------

/** השדות **המאומתים**. שדה שנפל בבדיקה הוא `null` — לא ניחוש, לא "בערך". */
export interface InvoiceFields {
  supplierName: string | null;
  supplierTaxId: string | null;
  invoiceNumber: string | null;
  issueDate: string | null;
  currency: InvoiceCurrency | null;
  subtotal: number | null;
  vatAmount: number | null;
  vatRate: number | null;
  total: number | null;
  documentKind: InvoiceDocumentKind;
}

export type InvoiceField = keyof InvoiceFields;

export type InvoiceIssueCode =
  | 'missing' // המודל לא החזיר ערך
  | 'notANumber'
  | 'outOfRange' // סכום שלילי, אפס, או גדול מהסביר
  | 'dateOutOfWindow' // מחוץ ל-[היום-3ש׳, היום+חודש]
  | 'dateMalformed'
  | 'unknownCurrency' // לא ב-enum הסגור
  | 'controlChars' // תווי בקרה / כיווניות בתוך שדה
  | 'tooLong'
  | 'vatMismatch' // לפני מע״מ + מע״מ ≠ סה״כ
  | 'vatRateImplausible'
  | 'injectionAttempt' // ציווי למערכת בתוך שדה של מסמך
  | 'paymentDetails' // ★ נראה כמו מספר חשבון / IBAN — נחסם, ראה למעלה
  | 'newSupplier'; // ★ ספק שלא ראיתי קודם

/**
 * `block` — השדה מאופס ומוצג ריק. `warn` — הערך נשמר אבל השורה מסומנת לבדיקה.
 * שתי הדרגות קיימות כי אין טעם לאפס את שם הספק בגלל אי-התאמה בחישוב המע״מ.
 */
export type InvoiceIssueSeverity = 'block' | 'warn';

export interface InvoiceIssue {
  field: InvoiceField | 'document';
  code: InvoiceIssueCode;
  severity: InvoiceIssueSeverity;
  /**
   * ★ מנוסח למי שיקרא אותו — בעלת העסק, לא מפתח.
   * "לא הצלחתי לקרוא את הסכום", ולא "amount failed range validation".
   */
  messageHe: string;
}

export interface InvoiceValidation {
  /** אין אף בעיה בכלל. */
  ok: boolean;
  /**
   * ★ השדה היחיד שמשנה התנהגות. `true` פירושו: השורה מוצגת עם שדות ריקים
   * והסבר, **לא נכנסת לסכום החודשי**, ובקובץ לרו״ח היא מסומנת "לבדיקה".
   */
  needsHumanReview: boolean;
  issues: InvoiceIssue[];
  /** מה ששרד. */
  value: InvoiceFields;
}

// ---------------------------------------------------------------------------
// ★ הרשומה הנשמרת
// ---------------------------------------------------------------------------

interface InvoiceRecordFields extends Timestamped, Expirable {
  /** מזהה יציב: `inv-<messageId>-<attachmentId>`. */
  id: string;
  /** ההודעה שממנה הגיעה. הקישור "למקור" שהמסך מציג. */
  sourceItemId: string;
  threadId: string;
  /** הדומיין של הספק. **דומיין אינו אדם** — אותו נימוק כמו בפריט רעש. */
  fromDomain: string;
  receivedAt: string;

  /** מטא הקובץ בלבד. התוכן לא נשמר כאן — הוא הקובץ עצמו. */
  attachment: AttachmentMeta;
  /** הנתיב הדטרמיניסטי שבו הקובץ נשמר. ראה `invoiceFiling.ts`. */
  filePath: string;

  detection: InvoiceDetection;

  /** ★ השדות המאומתים. זה מה שמוצג ומה שמסוכם. */
  fields: InvoiceFields;

  /**
   * ★ מה שהמודל אמר **לפני** האימות, כולל מה שנפסל.
   *
   * מוחזק בשביל דבר אחד: להראות לבעלת העסק, בתוך ההקשר של "לא הצלחתי לקרוא",
   * מה כן ראינו — "נראה כמו 1,234 ולא הצלחתי לוודא". הוא **לא** נכנס לשום
   * סכום, לא לעמודת סכום בקובץ לרו״ח, ולא מוצג בלי המילה "לא מאומת" לידו.
   * השם `unverified` הוא חלק מההגנה: אי אפשר לקרוא אותו בטעות כמשהו אחר.
   */
  unverified: InvoiceExtraction;

  needsHumanReview: boolean;
  issues: InvoiceIssue[];

  /**
   * `YYYY-MM` לקיבוץ בטבלה. נגזר מתאריך החשבונית כשהוא תקין, ואחרת מתאריך
   * המייל — ואז `monthKeySource` אומר את זה במפורש. חודש שנקבע לפי תאריך
   * המייל הוא ניחוש סביר, ולכן הוא מסומן ככזה במקום להיראות כמו עובדה.
   */
  monthKey: string;
  monthKeySource: 'issueDate' | 'receivedAt';

  modelId: string;
  /** סומנה כנבדקה בידי בעלת העסק. */
  reviewed: boolean;
}

export type Invoice = TenantScoped<InvoiceRecordFields>;

// ---------------------------------------------------------------------------
// סיכום חודשי
// ---------------------------------------------------------------------------

/**
 * סכום **לפי מטבע**, ולא סכום אחד.
 *
 * חיבור שקלים לדולרים בעמודה אחת הוא בדיוק סוג הטעות שנראית נכונה על המסך
 * ומתגלה אצל הרו״ח. אין כאן שער המרה ולא יהיה — המרה היא החלטה חשבונאית.
 */
export interface MonthlyTotal {
  currency: InvoiceCurrency;
  subtotal: number;
  vatAmount: number;
  total: number;
  count: number;
}

export interface MonthlySummary {
  monthKey: string;
  /** תווית קריאה: "יולי 2026". */
  monthLabelHe: string;
  invoices: Invoice[];
  totals: MonthlyTotal[];
  /** כמה שורות **לא** נכנסו לסכום כי הן ממתינות לבדיקה. */
  needsReviewCount: number;
}
