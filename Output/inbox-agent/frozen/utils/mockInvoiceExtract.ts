// ============================================================================
// mockInvoiceExtract.ts — חילוץ חשבונית **דטרמיניסטי**, בלי מודל ובלי רשת.
//
// תבנית: `mockExtract` מ-`Output/property-management/src/utils/aiExtract.js`,
// אותו עיקרון בדיוק — המוק מחזיר את **צורת הסכימה המלאה** שהמודל האמיתי
// יחזיר (`InvoiceExtraction`), כדי שכל השרשרת שאחריו — ולידציה, תיוק, טבלה,
// סכומים, ייצוא — תיבדק במלואה לפני שיש מפתח API.
//
// ---------------------------------------------------------------------------
// ★ המוק "קורא" טקסט, ולא ממציא נתונים
// ---------------------------------------------------------------------------
// זו ההחלטה שהופכת אותו לשימושי במקום לדקורטיבי. מוק שמחזיר
// `{ supplier: "ספק בע״מ", total: 1170 }` קבוע בודק רק שהמסך מרנדר. במקום זה
// הוא מפרסר **טקסט של מסמך** שיושב ב-fixture, בדיוק כמו שהמודל יפרסר PDF.
//
// התוצאה: אפשר לכתוב ב-fixture חשבונית שהסכום בה מטושטש, או שהמע״מ בה לא
// מסתדר, או שמוטמעת בה שורת הזרקה — ולראות את **הוולידציה האמיתית** נופלת
// עליהן. אלה בדיוק המקרים שיישברו בפרוסה 1, ועדיף לפגוש אותם עכשיו.
//
// ---------------------------------------------------------------------------
// מה שהמוק **לא** עושה, בכוונה
// ---------------------------------------------------------------------------
// הוא לא מתקן, לא משלים ולא מנחש. `סה״כ: ‏—` מחזיר `null` ולא "כנראה אפס".
// אותו כלל בדיוק יחול על ה-prompt בפרוסה 1 ("אל תמציא ערכים — אם שדה חסר
// החזר null"), ולכן עדיף שהמוק יתנהג כך כבר עכשיו: אחרת נבנה מסך שמניח
// שהשדות תמיד מלאים, וניפגש עם המציאות אחרי שהוא כבר בשימוש.
// ============================================================================

import type { AttachmentMeta, InvoiceExtraction } from '../types';
import { EMPTY_EXTRACTION } from '../types';

export const MOCK_INVOICE_MODEL_ID = 'mock-invoice:v1';

/**
 * הטקסט של המסמך, כפי שהוא מופיע ב-fixture.
 * בפרוסה 1 את מקומו תופס ה-PDF עצמו כ-`document` block, והפונקציה הזאת
 * נעלמת — `InvoiceExtraction` נשאר.
 */
export interface FixtureAttachment extends AttachmentMeta {
  /** תוכן המסמך כטקסט. **קיים ב-fixture בלבד.** לא נשמר בשום רשומה. */
  documentText: string;
}

// ---------------------------------------------------------------------------
// פרסור שדות
// ---------------------------------------------------------------------------

/**
 * מספר בפורמט חשבונית: `1,170.00` / `1170` / `1 170.50`.
 *
 * שים לב למה **אין** כאן: אין טיפול ב-`1.170,50` (פורמט אירופי). הוא נראה
 * זהה ל-`1170.50` בפורמט אמריקאי עם אלפים, ואין דרך להכריע בלי לדעת מי כתב
 * את המסמך. ניחוש כאן מכפיל סכום פי אלף — בדיוק סוג הטעות שהמערכת הזאת
 * נבנתה כדי לא לעשות. מסמך כזה יחזיר `null`, וייפול ל"לא הצלחתי לקרוא".
 */
function parseAmount(raw: string | undefined | null): number | null {
  if (!raw) return null;
  const s = String(raw).replace(/[\u200B-\u200F\u061C\u202A-\u202E\u2066-\u2069\uFEFF\u00AD]/g, '').trim();
  // פורמט אירופי מובהק: נקודה כמפריד אלפים ופסיק כעשרוני. לא מנחשים.
  if (/\d{1,3}(\.\d{3})+,\d{1,2}/.test(s)) return null;
  const cleaned = s.replace(/[,\s]/g, '');
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function firstMatch(text: string, patterns: RegExp[]): string | null {
  for (const re of patterns) {
    const m = re.exec(text);
    if (m && m[1] !== undefined) return m[1].trim();
  }
  return null;
}

/**
 * ★ `H` — רווח **אופקי בלבד**, ולא `\s`.
 *
 * זה לא פרט טכני. `\s` בולע גם `\n`, ולכן דפוס כמו `חשבונית מס\s*:?\s*(.+)`
 * על מסמך שהשורה הראשונה בו היא הכותרת "חשבונית מס" היה מדלג לשורה הבאה
 * ומחזיר את **התאריך** בתור מספר החשבונית. שדה שנקרא מהשורה הלא נכונה הוא
 * בדיוק "מספר שחולץ ולא אומת" — ומודל אמיתי עושה את הטעות הזאת גם.
 */
const H = '[ \\t]*';
const LINE_START = `(?:^|\\n)${H}`;
const AMOUNT = '([^\\n]{1,40})';

/** בונה דפוס "תווית: ערך" על שורה אחת. הנקודתיים **חובה** — ראה למעלה. */
function labeled(labelAlternatives: string, capture: string, flags = ''): RegExp {
  return new RegExp(`${LINE_START}(?:${labelAlternatives})${H}[:：]${H}${capture}`, flags);
}

const SUPPLIER_PATTERNS = [
  labeled('ספק|מאת|שם\\s+העסק|עוסק', '([^\\n]{1,80})'),
  labeled('supplier|vendor|from', '([^\\n]{1,80})', 'i'),
];

const TAX_ID_PATTERNS = [
  /(?:ע\.?מ\.?|עוסק\s+מורשה|ח\.?פ\.?|מספר\s+עוסק)[ \t]*[:：]?[ \t]*(\d[\d-]{5,})/,
  /\b(?:vat|tax)[ \t]*(?:id|no\.?|number)[ \t]*[:：]?[ \t]*([\w-]{5,20})/i,
];

const NUMBER_PATTERNS = [
  labeled('מספר\\s+חשבונית|מס[\'׳]?\\s+חשבונית|מספר\\s+מסמך|אסמכתא', '([^\\n]{1,40})'),
  labeled('invoice\\s*(?:no\\.?|number|#)|document\\s*no\\.?', '([^\\n]{1,40})', 'i'),
];

const DATE_PATTERNS = [
  labeled('תאריך\\s+הפקה|תאריך\\s+החשבונית|תאריך', '([^\\n]{1,30})'),
  labeled('date|issued', '([^\\n]{1,30})', 'i'),
];

const TOTAL_PATTERNS = [
  labeled('סה["״\']?כ\\s*לתשלום|סה["״\']?כ\\s*כולל\\s*מע["״\']?מ|לתשלום', AMOUNT),
  labeled('total\\s*(?:due|incl\\.?\\s*vat)?', AMOUNT, 'i'),
];

const SUBTOTAL_PATTERNS = [
  labeled('סה["״\']?כ\\s*לפני\\s*מע["״\']?מ|סכום\\s*לפני\\s*מע["״\']?מ|לפני\\s*מע["״\']?מ', AMOUNT),
  labeled('subtotal|net', AMOUNT, 'i'),
];

const VAT_PATTERNS = [
  labeled('מע["״\']?מ(?:\\s*\\d{1,2}(?:\\.\\d)?%)?', AMOUNT),
  labeled('(?:vat|tax)(?:\\s*\\d{1,2}(?:\\.\\d)?%)?', AMOUNT, 'i'),
];

const VAT_RATE_PATTERNS = [
  /(?:מע["״']?מ)\s*(\d{1,2}(?:\.\d)?)\s*%/,
  /\b(?:vat|tax)\s*(\d{1,2}(?:\.\d)?)\s*%/i,
];

/**
 * מטבע.
 *
 * ★ הסמלים ממופים לקוד, אבל **מחרוזת שאינה מוכרת מוחזרת כמות שהיא** ולא
 * הופכת ל-`null`. זה מכוון: הוולידציה היא זו שדוחה מטבע לא מוכר, וכך היא
 * יכולה לומר לבעלת העסק *מה* היה כתוב ("מטבע שאני לא מכיר: BTC") במקום
 * "לא זיהיתי מטבע". השקיפות הזאת היא ההבדל בין הודעה שאפשר לפעול לפיה
 * לבין הודעה שרק מתסכלת.
 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  '₪': 'ILS',
  'ש"ח': 'ILS',
  'ש״ח': 'ILS',
  שקל: 'ILS',
  NIS: 'ILS',
  $: 'USD',
  USD: 'USD',
  דולר: 'USD',
  '€': 'EUR',
  EUR: 'EUR',
  אירו: 'EUR',
  '£': 'GBP',
  GBP: 'GBP',
};

function parseCurrency(text: string): string | null {
  const explicit = firstMatch(text, [labeled('מטבע|currency', '([^\\n]{1,20})', 'i')]);
  if (explicit) {
    const key = explicit.trim();
    return CURRENCY_SYMBOLS[key] ?? CURRENCY_SYMBOLS[key.toUpperCase()] ?? key;
  }
  for (const [symbol, code] of Object.entries(CURRENCY_SYMBOLS)) {
    if (text.includes(symbol)) return code;
  }
  return null;
}

const KIND_HINTS: Array<{ kind: string; re: RegExp }> = [
  { kind: 'creditNote', re: /חשבונית\s*זיכוי|credit\s*note/i },
  { kind: 'invoiceReceipt', re: /חשבונית\s*מס\s*\/?\s*קבלה|invoice\s*&?\s*receipt/i },
  { kind: 'proforma', re: /דרישת\s*תשלום|פרופורמה|proforma/i },
  { kind: 'invoice', re: /חשבונית\s*מס|\btax\s*invoice\b|\binvoice\b/i },
  { kind: 'receipt', re: /(?:^|\n)\s*קבלה|\breceipt\b/i },
];

function parseKind(text: string): string {
  const hit = KIND_HINTS.find(({ re }) => re.test(text));
  return hit ? hit.kind : 'unknown';
}

/**
 * תאריך → `YYYY-MM-DD`, **רק** כשהצורה חד-משמעית.
 *
 * `13/07/2026` מומר (13 לא יכול להיות חודש). `03/04/2026` **לא** מומר —
 * הוא 3 באפריל או 4 במרץ, ואין דרך לדעת. הוא מוחזר כמות שהוא, והוולידציה
 * דוחה אותו עם ההסבר "לא בצורה שאני יודע לקרוא". זה נראה כמו החמרה מיותרת
 * עד שנזכרים שהתוצאה השנייה היא חשבונית שמשויכת לחודש הלא נכון בדוח למס.
 */
function parseDate(raw: string | null): string | null {
  if (!raw) return null;
  const s = raw.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (iso) return s;

  const dmy = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(s);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    // חד-משמעי רק אם היום גדול מ-12. אחרת מוחזר גולמי ונדחה בוולידציה.
    if (d > 12 && m >= 1 && m <= 12) {
      return `${dmy[3]}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    return s;
  }

  return s;
}

// ---------------------------------------------------------------------------
// ★ "קריאת המודל"
// ---------------------------------------------------------------------------

/**
 * מקבל את מטא הקובץ ואת הטקסט שלו, ומחזיר בדיוק את מה שהמודל יחזיר.
 * בלי רשת, בלי מפתח, ואותו קלט מחזיר תמיד אותו פלט.
 */
export function mockExtractInvoice(attachment: FixtureAttachment): InvoiceExtraction {
  const text = String(attachment.documentText ?? '');
  if (!text.trim()) return { ...EMPTY_EXTRACTION };

  return {
    supplierName: firstMatch(text, SUPPLIER_PATTERNS),
    supplierTaxId: firstMatch(text, TAX_ID_PATTERNS),
    invoiceNumber: firstMatch(text, NUMBER_PATTERNS),
    issueDate: parseDate(firstMatch(text, DATE_PATTERNS)),
    currency: parseCurrency(text),
    subtotal: parseAmount(firstMatch(text, SUBTOTAL_PATTERNS)),
    vatAmount: parseAmount(firstMatch(text, VAT_PATTERNS)),
    vatRate: (() => {
      const r = firstMatch(text, VAT_RATE_PATTERNS);
      return r === null ? null : Number(r);
    })(),
    total: parseAmount(firstMatch(text, TOTAL_PATTERNS)),
    documentKind: parseKind(text),
  };
}
