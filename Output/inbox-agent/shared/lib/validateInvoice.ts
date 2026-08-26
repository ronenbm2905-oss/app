// ============================================================================
// validateInvoice.ts — ★ הוולידציה **אחרי** המודל. פונקציה טהורה.
//
// ---------------------------------------------------------------------------
// מה זה עושה, במשפט אחד
// ---------------------------------------------------------------------------
// לוקח את מה שהמודל אמר שהוא ראה במסמך, ומחזיר שני דברים: מה שאפשר לסמוך
// עליו, ורשימת מה שלא — בעברית שאפשר להראות לבעלת העסק.
//
// ---------------------------------------------------------------------------
// ★ שדה שנפל מאופס. אף פעם לא מנוחש.
// ---------------------------------------------------------------------------
// זו ההחלטה היחידה שבאמת חשובה בקובץ הזה, וכל השאר נגזר ממנה.
//
// הפיתוי הוא לתקן: תאריך `13/07/2026` שנראה כמו `2026-07-13`, סכום `1.234,56`
// שכנראה `1234.56`, מטבע `שח` שכנראה `ILS`. כל תיקון כזה נכון ברוב המקרים —
// וזו בדיוק הבעיה. מערכת שמנחשת נכון ב-95% מהמקרים מלמדת את המשתמשת לסמוך
// עליה, ואז ה-5% עוברים בלי בדיקה. מערכת שמשאירה ריק מלמדת אותה שהריק דורש
// מבט, וזה נכון ב-100%.
//
// היוצא מן הכלל היחיד שמותר: **נרמול צורה שאינו מוסיף מידע** — הסרת רווחים,
// הסרת תווי כיווניות, המרת `ils`→`ILS`. שם לא מנחשים כלום, רק מסירים רעש.
//
// ---------------------------------------------------------------------------
// למה חשבונית צריכה ולידציה חמורה יותר מסיכום מייל
// ---------------------------------------------------------------------------
// סיווג שגוי של מייל מציג תווית לא נכונה. מספר שגוי בחשבונית מגיע לרו״ח,
// ומשם לדיווח למס. זה גם מה שהופך את **החשבונית העוינת** לתרחיש הקלאסי:
// מסמך שנראה כמו חשבונית ומכיל שורה שמכוונת למי שמעבד אותו. לכן `detectInjection`
// רץ כאן על שדות הטקסט של המסמך, ולא רק על גוף המייל.
// ============================================================================

import type {
  InvoiceCurrency,
  InvoiceDocumentKind,
  InvoiceExtraction,
  InvoiceFields,
  InvoiceIssue,
  InvoiceValidation,
} from '../types/invoice';
import { INVOICE_CURRENCIES, INVOICE_DOCUMENT_KINDS } from '../types/invoice';
import { detectInjection } from './detectInjection';

// ---------------------------------------------------------------------------
// גבולות
// ---------------------------------------------------------------------------

export interface ValidateInvoiceOptions {
  /** "היום" — מוזרק כדי שהמבחנים לא יהיו תלויים בשעון. */
  now?: Date | string;
  /**
   * תקרת סכום. 500,000 בכל מטבע — לא כי סכום גדול יותר בלתי אפשרי, אלא כי
   * אצל עסק יחיד הוא הרבה יותר סביר כתקלת פרסור (`1,234.56` שנקרא `123456`)
   * מאשר כחשבונית אמיתית. חשבונית אמיתית בסכום כזה תסומן לבדיקה — וזה בדיוק
   * מה שצריך לקרות לחשבונית בסכום כזה.
   */
  maxAmount?: number;
  /** סטייה מותרת בחישוב המע״מ, באגורות/סנטים. עיגול לגיטימי הוא ±1. */
  vatToleranceMinorUnits?: number;
  /**
   * ★ האם הספק כבר מוכר.
   *
   * `false` מוסיף `needsHumanReview` **גם כשהחילוץ הצליח לגמרי**, וזה נראה
   * מוגזם עד שמסתכלים על התרחיש: חשבונית ראשונה מספק חדש היא בדיוק הצורה
   * של הונאת "החלפת ספק". חשבונית שנייה מאותו ספק כבר לא תסומן, ולכן
   * המחיר הוא מבט אחד פר-ספק — לכל החיים.
   */
  supplierIsKnown?: boolean;
}

const DEFAULT_MAX_AMOUNT = 500_000;
const MIN_AMOUNT = 0.01;
const DEFAULT_VAT_TOLERANCE_MINOR = 2;

/** שלוש שנים אחורה: מספיק לדיווח מתקן, ולא מספיק ל"תאריך משנת 1970". */
const PAST_WINDOW_YEARS = 3;
/** חודש קדימה: חשבונית עתידית קיימת (הוראת קבע), חשבונית לשנה הבאה — לא. */
const FUTURE_WINDOW_DAYS = 31;

/** שיעורי מע״מ סבירים באחוזים. 0 קיים (עוסק פטור, יצוא). */
const MIN_VAT_RATE = 0;
const MAX_VAT_RATE = 30;

/** מספר חשבונית ארוך מ-40 תווים אינו מספר חשבונית אלא שורת טקסט שנקלטה. */
const MAX_INVOICE_NUMBER_LENGTH = 40;
const MAX_SUPPLIER_NAME_LENGTH = 80;
const MAX_TAX_ID_LENGTH = 20;

// ---------------------------------------------------------------------------
// עזרים טהורים
// ---------------------------------------------------------------------------

/** תווי בקרה, zero-width וכיווניות. אין להם שום מקום בשדה של מסמך. */
const CONTROL_OR_INVISIBLE_RE =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/;

const URL_RE = /(https?:\/\/|www\.)/i;

/**
 * ★ דפוסים של פרטי תשלום. ראה את ההערה הארוכה ב-`shared/types/invoice.ts`:
 * חשבונית מזויפת עם חשבון בנק מוחלף היא תרחיש ההונאה המרכזי, וטבלה מסודרת
 * שמכילה את המספר הזה מוחקת את החשד שהוא ההגנה היחידה מולו.
 *
 * הבדיקה כאן היא **חגורה שנייה**: הסכימה ממילא לא מכילה שדה לפרטי תשלום,
 * אבל מסמך יכול לדחוף IBAN לתוך שדה "שם ספק" — וכך לעקוף את היעדר השדה.
 * הדפוסים מכוונים לצורות שאי אפשר לבלבל עם שם או מספר חשבונית.
 */
const PAYMENT_DETAIL_PATTERNS: RegExp[] = [
  // IBAN: שתי אותיות מדינה, שתי ספרות ביקורת, ואז 10+ תווים.
  /\b[A-Z]{2}\d{2}[A-Z0-9]{10,28}\b/,
  /\b(iban|swift|bic)\b/i,
  /(מספר\s+חשבון|חשבון\s+בנק|מס['׳]?\s+חשבון)/,
  /(בנק\s+\d{1,3}|סניף\s*\d{2,4})/,
  // מספר כרטיס: 13–19 ספרות ברצף או בקבוצות.
  /\b(?:\d[ -]?){13,19}\b/,
];

function looksLikePaymentDetails(s: string): boolean {
  return PAYMENT_DETAIL_PATTERNS.some((re) => re.test(s));
}

function asDate(v: Date | string | undefined): Date {
  if (v instanceof Date) return v;
  if (typeof v === 'string') {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return new Date();
}

/** נרמול צורה בלבד: רווחים, כיווניות. **לא** מתקן תוכן. */
function tidy(raw: string | null | undefined): string {
  return String(raw ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** עיגול לשתי ספרות, בלי שגיאות נקודה צפה. */
function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function issue(
  field: InvoiceIssue['field'],
  code: InvoiceIssue['code'],
  severity: InvoiceIssue['severity'],
  messageHe: string,
): InvoiceIssue {
  return { field, code, severity, messageHe };
}

// ---------------------------------------------------------------------------
// ★ הפונקציה
// ---------------------------------------------------------------------------

export function validateInvoice(
  raw: InvoiceExtraction,
  opts: ValidateInvoiceOptions = {},
): InvoiceValidation {
  const now = asDate(opts.now);
  const maxAmount = opts.maxAmount ?? DEFAULT_MAX_AMOUNT;
  const vatTolerance = (opts.vatToleranceMinorUnits ?? DEFAULT_VAT_TOLERANCE_MINOR) / 100;

  const issues: InvoiceIssue[] = [];

  // --- מטבע: enum סגור, בלי ניחוש -------------------------------------------
  // `שח`, `NIS`, `₪` — כולם "כנראה שקלים". `כנראה` הוא בדיוק מה שאסור כאן,
  // כי מטבע שגוי הופך חשבונית של 300 דולר לחשבונית של 300 שקל בטבלה.
  let currency: InvoiceCurrency | null = null;
  const rawCurrency = tidy(raw.currency).toUpperCase();
  if (!rawCurrency) {
    issues.push(issue('currency', 'missing', 'block', 'לא הצלחתי לזהות באיזה מטבע החשבונית'));
  } else if ((INVOICE_CURRENCIES as readonly string[]).includes(rawCurrency)) {
    currency = rawCurrency as InvoiceCurrency;
  } else {
    issues.push(
      issue('currency', 'unknownCurrency', 'block', `במסמך כתוב מטבע שאני לא מכיר ("${rawCurrency}")`),
    );
  }

  // --- סכומים ---------------------------------------------------------------
  const total = checkAmount(raw.total, 'total', 'הסכום הכולל', issues, maxAmount);
  const subtotal = checkAmount(raw.subtotal, 'subtotal', 'הסכום לפני מע״מ', issues, maxAmount, {
    optional: true,
  });
  const vatAmount = checkAmount(raw.vatAmount, 'vatAmount', 'המע״מ', issues, maxAmount, {
    optional: true,
    allowZero: true,
  });

  // --- שיעור מע״מ -----------------------------------------------------------
  let vatRate: number | null = null;
  if (raw.vatRate !== null && raw.vatRate !== undefined) {
    const r = Number(raw.vatRate);
    if (!Number.isFinite(r)) {
      issues.push(issue('vatRate', 'notANumber', 'warn', 'לא הצלחתי לקרוא את אחוז המע״מ'));
    } else if (r < MIN_VAT_RATE || r > MAX_VAT_RATE) {
      issues.push(
        issue('vatRate', 'vatRateImplausible', 'warn', `אחוז המע״מ שקראתי (${r}%) לא נראה סביר`),
      );
    } else {
      vatRate = r;
    }
  }

  // --- ★ בדיקת החשבון: לפני מע״מ + מע״מ = סה״כ ------------------------------
  // זו הבדיקה שתופסת את הכשל הכי מסוכן — ספרה שנקראה לא נכון. שלושת המספרים
  // מגיעים מאותו מסמך, ולכן אי-התאמה ביניהם היא סימן שאחד מהם שגוי; איננו
  // יודעים איזה, ולכן **שלושתם** מסומנים לבדיקה במקום לתקן אחד מהם.
  if (total !== null && subtotal !== null && vatAmount !== null) {
    const expected = round2(subtotal + vatAmount);
    if (Math.abs(expected - total) > vatTolerance) {
      issues.push(
        issue(
          'total',
          'vatMismatch',
          'warn',
          `החישוב לא מסתדר: ${subtotal} + ${vatAmount} לא שווה ל-${total}`,
        ),
      );
    }
  }

  // --- תאריך ----------------------------------------------------------------
  const issueDate = checkDate(raw.issueDate, now, issues);

  // --- מספר חשבונית ---------------------------------------------------------
  const invoiceNumber = checkTextField(
    raw.invoiceNumber,
    'invoiceNumber',
    'מספר החשבונית',
    MAX_INVOICE_NUMBER_LENGTH,
    issues,
  );

  // --- שם ספק ---------------------------------------------------------------
  const supplierName = checkTextField(
    raw.supplierName,
    'supplierName',
    'שם הספק',
    MAX_SUPPLIER_NAME_LENGTH,
    issues,
  );

  // --- מספר עוסק ------------------------------------------------------------
  const supplierTaxId = checkTextField(
    raw.supplierTaxId,
    'supplierTaxId',
    'מספר העוסק',
    MAX_TAX_ID_LENGTH,
    issues,
    { optional: true },
  );

  // --- סוג המסמך ------------------------------------------------------------
  const kindRaw = tidy(raw.documentKind);
  const documentKind: InvoiceDocumentKind = (
    INVOICE_DOCUMENT_KINDS as readonly string[]
  ).includes(kindRaw)
    ? (kindRaw as InvoiceDocumentKind)
    : 'unknown';

  // --- ★ הזרקה בתוך שדות המסמך ---------------------------------------------
  // חשבונית עוינת לא תנסה להזריק דרך גוף המייל — היא תנסה דרך שדה במסמך,
  // כי שם אף אחד לא מסתכל. שדה כזה מאופס במלואו: אין ערך "חלקית בטוח".
  const textUnderTest = [raw.supplierName, raw.invoiceNumber, raw.supplierTaxId]
    .filter(Boolean)
    .join('\n');
  const injected = detectInjection(textUnderTest);
  if (injected) {
    issues.push(
      issue(
        'document',
        'injectionAttempt',
        'block',
        'במסמך יש טקסט שמנסה להורות לי מה לעשות. לא מילאתי ממנו שום שדה — כדאי שתפתחי אותו',
      ),
    );
  }

  // --- ★ ספק חדש --------------------------------------------------------
  // אזהרה ולא חסימה: הנתונים נשמרים ומוצגים, אבל השורה לא נכנסת לסכום ולא
  // יוצאת כ"נבדק" לרו״ח לפני שמישהו הסתכל. זו בדיוק הצורה של הונאת החלפת
  // ספק — חשבונית ראשונה מגורם שלא היה שם קודם.
  if (opts.supplierIsKnown === false) {
    issues.push(
      issue(
        'supplierName',
        'newSupplier',
        'warn',
        'זו הפעם הראשונה שאני רואה חשבונית מהספק הזה — שווה לוודא שהיא אמיתית לפני שמשלמים',
      ),
    );
  }

  const blocked = new Set(issues.filter((i) => i.severity === 'block').map((i) => i.field));

  const value: InvoiceFields = {
    supplierName: injected || blocked.has('supplierName') ? null : supplierName,
    supplierTaxId: injected || blocked.has('supplierTaxId') ? null : supplierTaxId,
    invoiceNumber: injected || blocked.has('invoiceNumber') ? null : invoiceNumber,
    issueDate: blocked.has('issueDate') ? null : issueDate,
    currency: blocked.has('currency') ? null : currency,
    subtotal: blocked.has('subtotal') ? null : subtotal,
    vatAmount: blocked.has('vatAmount') ? null : vatAmount,
    vatRate,
    total: blocked.has('total') ? null : total,
    documentKind: injected ? 'unknown' : documentKind,
  };

  // ★ שורה נכנסת לסכום החודשי **רק** אם יש גם סכום וגם מטבע וגם תאריך, ואין
  // אף בעיה. די באזהרה אחת (אי-התאמת חישוב) כדי להוציא אותה מהסכום — כי
  // סכום שמכיל שורה מסופקת הוא מספר שגוי שנראה סמכותי, וזה מה שאסור כאן.
  const needsHumanReview =
    issues.length > 0 || value.total === null || value.currency === null || value.issueDate === null;

  return { ok: issues.length === 0, needsHumanReview, issues, value };
}

// ---------------------------------------------------------------------------
// בדיקות שדה
// ---------------------------------------------------------------------------

function checkAmount(
  raw: number | null | undefined,
  field: 'total' | 'subtotal' | 'vatAmount',
  labelHe: string,
  issues: InvoiceIssue[],
  maxAmount: number,
  opts: { optional?: boolean; allowZero?: boolean } = {},
): number | null {
  if (raw === null || raw === undefined) {
    if (!opts.optional) {
      issues.push(issue(field, 'missing', 'block', `לא הצלחתי לקרוא את ${labelHe} מהמסמך`));
    }
    return null;
  }

  const n = Number(raw);
  if (!Number.isFinite(n)) {
    issues.push(issue(field, 'notANumber', 'block', `${labelHe} לא נקרא כמספר`));
    return null;
  }

  const floor = opts.allowZero ? 0 : MIN_AMOUNT;
  if (n < floor) {
    // סכום שלילי אינו "חשבונית זיכוי שנקראה נכון" — חשבונית זיכוי מסומנת
    // ב-`documentKind` והסכום שלה חיובי. שלילי כאן הוא תמיד תקלת קריאה.
    issues.push(issue(field, 'outOfRange', 'block', `${labelHe} שקראתי (${n}) לא יכול להיות נכון`));
    return null;
  }
  if (n > maxAmount) {
    issues.push(
      issue(
        field,
        'outOfRange',
        'block',
        `${labelHe} שקראתי (${n}) גבוה בצורה חריגה — כנראה לא קראתי נכון`,
      ),
    );
    return null;
  }

  return round2(n);
}

/**
 * תאריך בטווח `[היום-3 שנים, היום+חודש]`.
 *
 * הפורמט הנדרש הוא `YYYY-MM-DD` **בלבד**, ובכוונה: `03/04/2026` הוא 3 באפריל
 * או 4 במרץ, תלוי מי כתב אותו. אין דרך לדעת, ולכן אין ניחוש — הוא נדחה.
 */
function checkDate(
  raw: string | null | undefined,
  now: Date,
  issues: InvoiceIssue[],
): string | null {
  const s = tidy(raw);
  if (!s) {
    issues.push(issue('issueDate', 'missing', 'block', 'לא הצלחתי לקרוא את תאריך החשבונית'));
    return null;
  }

  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) {
    issues.push(
      issue('issueDate', 'dateMalformed', 'block', `התאריך שקראתי ("${s}") לא בצורה שאני יודע לקרוא`),
    );
    return null;
  }

  const [, y, mo, d] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d));
  // בדיקת קיום אמיתי: `2026-02-31` עובר את ה-regex ומתגלגל ל-3 במרץ.
  if (
    date.getFullYear() !== Number(y) ||
    date.getMonth() !== Number(mo) - 1 ||
    date.getDate() !== Number(d)
  ) {
    issues.push(issue('issueDate', 'dateMalformed', 'block', `התאריך שקראתי ("${s}") לא קיים בלוח השנה`));
    return null;
  }

  const min = new Date(now.getFullYear() - PAST_WINDOW_YEARS, now.getMonth(), now.getDate());
  const max = new Date(now.getFullYear(), now.getMonth(), now.getDate() + FUTURE_WINDOW_DAYS);

  if (date < min) {
    issues.push(
      issue('issueDate', 'dateOutOfWindow', 'block', `התאריך שקראתי (${s}) ישן מדי — כנראה לא קראתי נכון`),
    );
    return null;
  }
  if (date > max) {
    issues.push(
      issue('issueDate', 'dateOutOfWindow', 'block', `התאריך שקראתי (${s}) הוא בעתיד — כנראה לא קראתי נכון`),
    );
    return null;
  }

  return s;
}

function checkTextField(
  raw: string | null | undefined,
  field: 'invoiceNumber' | 'supplierName' | 'supplierTaxId',
  labelHe: string,
  maxLength: number,
  issues: InvoiceIssue[],
  opts: { optional?: boolean } = {},
): string | null {
  // ★ הבדיקה על הגולמי ולא על המנורמל: `tidy` מסיר תווי כיווניות, ואם נבדוק
  // אחריו נדווח "נקי" על שדה שהכיל RLO. התו הוסר — אבל **העובדה שהוא היה שם**
  // היא מידע על השולח, וזה בדיוק סוג המידע שאסור לאבד בשקט.
  const original = String(raw ?? '');
  const s = tidy(raw);

  if (!s) {
    if (!opts.optional) {
      issues.push(issue(field, 'missing', 'block', `לא הצלחתי לקרוא את ${labelHe} מהמסמך`));
    }
    return null;
  }

  if (CONTROL_OR_INVISIBLE_RE.test(original)) {
    issues.push(
      issue(field, 'controlChars', 'block', `${labelHe} מכיל תווים מוסתרים — לא סמכתי עליו`),
    );
    return null;
  }

  if (URL_RE.test(s)) {
    // כתובת אינטרנט בשדה של מספר חשבונית או שם ספק אינה שגיאת קריאה אלא
    // ניסיון להשתיל קישור למקום שבו המשתמשת מצפה לנתון. אותו נימוק בדיוק
    // כמו ב-`sanitize.ts`, ששם כל URL מוחלף.
    issues.push(issue(field, 'controlChars', 'block', `ב${labelHe} יש קישור — זה לא אמור לקרות`));
    return null;
  }

  if (s.length > maxLength) {
    issues.push(issue(field, 'tooLong', 'block', `${labelHe} ארוך מדי — כנראה קראתי שורה שלמה במקום`));
    return null;
  }

  // ★ פרטי תשלום — נחסמים בכל שדה, גם כשהם נראים חלק מהשם.
  // זו הדרך היחידה שנשארה למסמך לדחוף מספר חשבון לטבלה אחרי שאין לו שדה
  // ייעודי: להחביא אותו בשדה טקסט אחר. ראה ההערה ב-`shared/types/invoice.ts`.
  if (looksLikePaymentDetails(s)) {
    issues.push(
      issue(
        field,
        'paymentDetails',
        'block',
        `ב${labelHe} מופיעים מה שנראה כמו פרטי בנק. אני אף פעם לא מעתיק פרטי תשלום מחשבונית — תמיד בדקי אותם מול הספק`,
      ),
    );
    return null;
  }

  return s;
}
